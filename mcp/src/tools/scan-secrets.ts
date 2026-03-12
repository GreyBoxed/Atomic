import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validatePath } from "../lib/git.js";
import { scanFiles } from "../lib/secret-scanner.js";

export function registerScanSecrets(server: McpServer): void {
  server.tool(
    "scan_secrets",
    "Scan files for secrets (API keys, passwords, private keys, sensitive filenames). Returns structured findings the agent can act on.",
    {
      files: z
        .array(z.string())
        .min(1)
        .describe("File paths to scan for secrets"),
    },
    {
      title: "Scan files for secrets",
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    async ({ files }) => {
      const cwd = process.cwd();

      try {
        // Validate all paths (standalone tool must validate)
        for (const file of files) {
          await validatePath(file, cwd);
        }

        const findings = await scanFiles(files, cwd);

        const result = {
          scanned: files.length,
          findings,
          clean: findings.length === 0,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
