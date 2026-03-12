import { z } from "zod";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { git } from "../lib/git.js";
import { parseDiff } from "../lib/hunk-parser.js";

async function validatePath(filePath: string, cwd: string): Promise<void> {
  if (
    filePath.includes("..") ||
    filePath.startsWith("/") ||
    filePath.includes("\x00") ||
    filePath.startsWith("-")
  ) {
    throw new Error(`Invalid file path (path traversal rejected): ${filePath}`);
  }
  try {
    const absolute = resolve(cwd, filePath);
    const real = await realpath(absolute);
    const toplevel = (
      await git(["rev-parse", "--show-toplevel"], cwd)
    ).stdout.trim();
    if (!real.startsWith(toplevel + "/") && real !== toplevel) {
      throw new Error(`Path escapes repository: ${filePath}`);
    }
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw err;
  }
}

export function registerFileHunks(server: McpServer): void {
  server.tool(
    "file_hunks",
    "Parse unstaged changes into individual diff hunks for sub-file staging. Returns structured hunk data per file with previews.",
    {
      file: z
        .string()
        .optional()
        .describe("Optional file path to filter (relative to repo root)"),
    },
    {
      title: "Parse file hunks",
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    async ({ file }) => {
      const cwd = process.cwd();

      try {
        // When no file filter, return file list only (avoids unbounded diff output)
        if (!file) {
          const nameResult = await git(["diff", "--name-only"], cwd);
          if (!nameResult.stdout.trim()) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    { files: [], message: "No unstaged changes found" },
                    null,
                    2
                  ),
                },
              ],
            };
          }
          const fileNames = nameResult.stdout.trim().split("\n").filter(Boolean);
          // Get per-file stats for change counts
          const statResult = await git(["diff", "--stat"], cwd);
          const statLines = statResult.stdout.trim().split("\n");
          const statMap = new Map<string, string>();
          for (const line of statLines) {
            if (line.includes("|")) {
              const [name, changes] = line.split("|").map((s) => s.trim());
              if (name) statMap.set(name, changes ?? "");
            }
          }
          const files = fileNames.map((name) => ({
            path: name,
            stat: statMap.get(name) ?? "",
            message: "Call file_hunks with file parameter for hunk details",
          }));
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ files }, null, 2),
              },
            ],
          };
        }

        await validatePath(file, cwd);
        const diffResult = await git(["diff", "--", file], cwd);

        if (!diffResult.stdout.trim()) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { files: [], message: "No unstaged changes found" },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const fileDiffs = parseDiff(diffResult.stdout);

        const files = fileDiffs.map((fd) => ({
          path: fd.path,
          hunk_count: fd.hunks.length,
          hunks: fd.hunks.map((hunk, index) => {
            const changedLines = hunk.lines.filter(
              (l) => l.startsWith("+") || l.startsWith("-")
            );
            const preview = hunk.lines
              .filter((l) => l.length > 0)
              .slice(0, 3)
              .join("\n");

            return {
              index,
              header: hunk.header,
              context: hunk.context,
              preview,
              lines_changed: changedLines.length,
            };
          }),
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ files }, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
