import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { git, parseStatusFiles, validatePath } from "../lib/git.js";
import { scanFiles, ScanSecretsMode } from "../lib/secret-scanner.js";

const fileEntrySchema = z.union([
  z.string().describe("File path to stage entirely"),
  z.object({
    path: z.string().describe("File path"),
    hunks: z
      .array(z.number())
      .describe("Hunk indices to stage (from file_hunks output)"),
  }),
]);

const GroupSchema = z.object({
  message: z.string().min(1).max(2000).describe("Commit message for this group"),
  files: z.array(fileEntrySchema).min(1).describe("Files to include in this commit"),
});

interface GroupPreview {
  message: string;
  files: string[];
  warnings: string[];
}

export function registerDryRun(server: McpServer): void {
  server.tool(
    "dry_run",
    "Validate commit groups without executing. Checks file paths exist in git status and detects cross-group conflicts.",
    {
      groups: z
        .array(GroupSchema)
        .min(1)
        .describe("Ordered list of commit groups to validate"),
      scanSecrets: ScanSecretsMode,
    },
    {
      title: "Validate commit plan",
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    async ({ groups, scanSecrets }) => {
      const cwd = process.cwd();

      try {
        const statusResult = await git(["status", "--short"], cwd);
        const statusFiles = parseStatusFiles(statusResult.stdout);

        const errors: string[] = [];
        const fileToGroups = new Map<string, number[]>();
        const groupPreviews: GroupPreview[] = [];

        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          const warnings: string[] = [];

          const filePaths: string[] = [];
          for (const entry of group.files) {
            const filePath = typeof entry === "string" ? entry : entry.path;
            filePaths.push(filePath);

            try {
              await validatePath(filePath, cwd);
            } catch {
              errors.push(
                `Group ${i + 1}: invalid path "${filePath}" (path traversal rejected)`
              );
              continue;
            }

            const existing = fileToGroups.get(filePath) || [];
            existing.push(i + 1);
            fileToGroups.set(filePath, existing);

            if (!statusFiles.has(filePath)) {
              warnings.push(`${filePath} is not in git status`);
            }
          }

          groupPreviews.push({
            message: group.message,
            files: filePaths,
            warnings,
          });
        }

        // Scan for secrets across all unique files at once
        if (scanSecrets === "block") {
          const allFiles = [...fileToGroups.keys()];
          const findings = await scanFiles(allFiles, cwd);
          if (findings.length > 0) {
            // Attribute findings to their groups
            for (const finding of findings) {
              const groupIndices = fileToGroups.get(finding.file);
              if (groupIndices) {
                for (const idx of groupIndices) {
                  const preview = groupPreviews[idx - 1];
                  if (preview) {
                    preview.warnings.push(
                      `Secret detected in ${finding.file}: ${finding.pattern}${finding.line ? ` (line ${finding.line})` : ""}`
                    );
                  }
                }
              }
            }
          }
        }

        for (const [file, groupIndices] of fileToGroups) {
          if (groupIndices.length > 1) {
            errors.push(
              `${file} appears in group ${groupIndices.join(" and group ")}`
            );
          }
        }

        const valid =
          errors.length === 0 &&
          groupPreviews.every((g) => g.warnings.length === 0);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ valid, groups: groupPreviews, errors }, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error during dry run: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
