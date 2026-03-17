import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { git } from "../lib/git.js";

export interface ParsedCommit {
  hash: string;
  type: string;
  scope: string | null;
  subject: string;
}

const CONVENTIONAL_RE = /^(\w+)(?:\(([^)]*)\))?!?:\s*(.+)$/;

const TYPE_LABELS: Record<string, string> = {
  feat: "Features",
  fix: "Bug Fixes",
  docs: "Documentation",
  style: "Styles",
  refactor: "Refactoring",
  perf: "Performance",
  test: "Tests",
  build: "Build",
  ci: "CI",
  chore: "Chores",
  revert: "Reverts",
};

export function parseCommitLine(line: string): ParsedCommit {
  const [hash, ...rest] = line.split("|");
  const subject = rest.join("|");
  const match = CONVENTIONAL_RE.exec(subject);
  if (match) {
    return {
      hash: hash!,
      type: match[1]!,
      scope: match[2] ?? null,
      subject: match[3]!,
    };
  }
  return { hash: hash!, type: "other", scope: null, subject };
}

export function groupByType(commits: ParsedCommit[]): Map<string, ParsedCommit[]> {
  const groups = new Map<string, ParsedCommit[]>();
  for (const c of commits) {
    const existing = groups.get(c.type);
    if (existing) {
      existing.push(c);
    } else {
      groups.set(c.type, [c]);
    }
  }
  return groups;
}

export function toMarkdown(groups: Map<string, ParsedCommit[]>): string {
  const sections: string[] = ["# Changelog", ""];
  for (const [type, commits] of groups) {
    const label = TYPE_LABELS[type] ?? type;
    sections.push(`## ${label}`, "");
    for (const c of commits) {
      const scope = c.scope ? `**${c.scope}:** ` : "";
      sections.push(`- ${scope}${c.subject} (\`${c.hash.slice(0, 7)}\`)`);
    }
    sections.push("");
  }
  return sections.join("\n");
}

export function toJson(
  groups: Map<string, ParsedCommit[]>
): string {
  const obj: Record<
    string,
    Array<{ hash: string; scope: string | null; subject: string }>
  > = {};
  for (const [type, commits] of groups) {
    obj[type] = commits.map((c) => ({
      hash: c.hash,
      scope: c.scope,
      subject: c.subject,
    }));
  }
  return JSON.stringify(obj, null, 2);
}

export function registerGenerateChangelog(server: McpServer): void {
  server.tool(
    "generate_changelog",
    "Generate a changelog from conventional commit messages between two git refs.",
    {
      from: z
        .string()
        .optional()
        .describe(
          "Start ref (tag or commit hash). Defaults to the latest tag or the first commit."
        ),
      to: z.string().optional().describe("End ref. Defaults to HEAD."),
      format: z
        .enum(["markdown", "json"])
        .optional()
        .describe("Output format. Defaults to markdown."),
    },
    {
      title: "Generate changelog",
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    async ({ from, to, format }) => {
      const cwd = process.cwd();
      const SAFE_REF = /^[a-zA-Z0-9._\/][a-zA-Z0-9._\/-]*$/;

      try {
        if (from && !SAFE_REF.test(from)) {
          throw new Error(`Invalid ref: ${from}`);
        }
        if (to && !SAFE_REF.test(to)) {
          throw new Error(`Invalid ref: ${to}`);
        }

        const toRef = to ?? "HEAD";
        let fromRef = from;

        if (!fromRef) {
          try {
            const { stdout: tagOut } = await git(
              ["describe", "--tags", "--abbrev=0"],
              cwd
            );
            fromRef = tagOut.trim();
          } catch {
            const { stdout: firstOut } = await git(
              ["rev-list", "--max-parents=0", "HEAD"],
              cwd
            );
            fromRef = firstOut.trim().split("\n")[0]!;
          }
        }

        const range = `${fromRef}..${toRef}`;
        const { stdout: logOut } = await git(
          ["log", "--format=%H|%s", range],
          cwd
        );

        if (!logOut.trim()) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No commits found in range ${range}.`,
              },
            ],
          };
        }

        const commits = logOut.trim().split("\n").map(parseCommitLine);
        const groups = groupByType(commits);
        const outputFormat = format ?? "markdown";
        const output =
          outputFormat === "json" ? toJson(groups) : toMarkdown(groups);

        return {
          content: [{ type: "text" as const, text: output }],
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
