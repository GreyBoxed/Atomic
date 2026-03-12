import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { git } from "../lib/git.js";
import { getBatchInfo } from "../lib/batch-info.js";
import { validateRange } from "../lib/ref-validation.js";

const MAX_REVIEW_COMMITS = 50;

interface CommitData {
  sha: string;
  message: string;
  files_changed: string[];
  insertions: number;
  deletions: number;
  diff: string;
}

/**
 * Parse `git log --numstat` output to extract per-commit file stats.
 * Format: "insertions\tdeletions\tfilename" lines after each commit header.
 */
function parseNumstat(
  numstatOutput: string,
  shas: string[]
): Map<string, { files: string[]; ins: number; del: number }> {
  const result = new Map<
    string,
    { files: string[]; ins: number; del: number }
  >();

  // Split by commit boundaries using the SHA markers
  const blocks = numstatOutput.split(/^commit /m).filter(Boolean);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const sha = lines[0]?.trim();
    if (!sha || !shas.includes(sha)) continue;

    const files: string[] = [];
    let ins = 0;
    let del = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      // numstat lines: "N\tN\tfilename" (or "-\t-\tfilename" for binary)
      const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (match) {
        const added = match[1] === "-" ? 0 : parseInt(match[1]!, 10);
        const removed = match[2] === "-" ? 0 : parseInt(match[2]!, 10);
        ins += added;
        del += removed;
        files.push(match[3]!);
      }
    }

    result.set(sha, { files, ins, del });
  }

  return result;
}

/**
 * Parse combined `git log -p` output into per-commit diffs.
 * Splits on "commit <sha>" lines that git produces.
 */
function parseDiffs(
  diffOutput: string,
  shas: string[]
): Map<string, string> {
  const result = new Map<string, string>();
  // Split on lines that start with "commit " followed by a full SHA
  const blocks = diffOutput.split(/^(?=commit [0-9a-f]{40})/m).filter(Boolean);

  for (const block of blocks) {
    const firstNewline = block.indexOf("\n");
    const headerLine = block.slice(0, firstNewline).trim();
    const sha = headerLine.replace("commit ", "").trim();

    if (!shas.includes(sha)) continue;

    // Everything after the first blank line pair is diff content
    // Skip the commit header lines (Author:, Date:, message, etc.)
    const diffStart = block.indexOf("\ndiff ");
    if (diffStart !== -1) {
      result.set(sha, block.slice(diffStart + 1));
    } else {
      result.set(sha, "");
    }
  }

  return result;
}

async function resolveRange(
  range: string | undefined,
  cwd: string
): Promise<{ resolved: string; description: string; resolution: string }> {
  // Explicit range provided
  if (range && range !== "last-batch") {
    const parsed = validateRange(range);

    if (parsed.kind === "range") {
      // Validate both refs exist
      await git(["rev-parse", "--verify", parsed.from], cwd);
      await git(["rev-parse", "--verify", parsed.to], cwd);
      return {
        resolved: `${parsed.from}..${parsed.to}`,
        description: `Commits in ${parsed.from}..${parsed.to}`,
        resolution: "explicit",
      };
    }

    // Single ref: interpret as ref..HEAD
    await git(["rev-parse", "--verify", parsed.ref], cwd);
    return {
      resolved: `${parsed.ref}..HEAD`,
      description: `Commits since ${parsed.ref}`,
      resolution: "explicit",
    };
  }

  // Default: try batch info
  const batchInfo = getBatchInfo();
  if (batchInfo) {
    // Verify repo matches
    const toplevel = (
      await git(["rev-parse", "--show-toplevel"], cwd)
    ).stdout.trim();
    if (toplevel !== batchInfo.repoToplevel) {
      throw new Error(
        "Batch info is from a different repository. Specify a range explicitly (e.g., main..HEAD, HEAD~5)."
      );
    }

    // Verify headBefore is still an ancestor of HEAD
    try {
      await git(
        ["merge-base", "--is-ancestor", batchInfo.headBefore, "HEAD"],
        cwd
      );
    } catch {
      throw new Error(
        "Batch info is stale (HEAD has diverged). Specify a range explicitly (e.g., main..HEAD, HEAD~5)."
      );
    }

    return {
      resolved: `${batchInfo.headBefore}..HEAD`,
      description: `${batchInfo.commitCount} commit(s) from last atomic batch`,
      resolution: "batch-info",
    };
  }

  throw new Error(
    "No batch info available. Specify a range explicitly (e.g., main..HEAD, HEAD~5, or abc123..def456)."
  );
}

export function registerReviewCommits(server: McpServer): void {
  server.tool(
    "review_commits",
    "Gather structured commit and diff data for review. Returns commits with messages and per-commit diffs for a given range.",
    {
      range: z
        .string()
        .max(256)
        .optional()
        .describe(
          "Commit range: SHA..SHA, branch name, HEAD~N, or 'last-batch'. Defaults to last atomic batch."
        ),
    },
    {
      title: "Review commits",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ range }) => {
      const cwd = process.cwd();

      try {
        // 1. Resolve range
        const { resolved, description, resolution } = await resolveRange(
          range,
          cwd
        );

        // 2. Count commits to enforce cap
        const countResult = await git(
          ["rev-list", "--count", "--no-merges", resolved],
          cwd
        );
        const commitCount = parseInt(countResult.stdout.trim(), 10);

        if (commitCount > MAX_REVIEW_COMMITS) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: Range contains ${commitCount} commits (max ${MAX_REVIEW_COMMITS}). Narrow the range.`,
              },
            ],
            isError: true,
          };
        }

        if (commitCount === 0) {
          const result = {
            range: resolved,
            range_description: "No commits found in range",
            range_resolution: resolution,
            commits: [],
            diff_stat: "",
          };
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        // 3. Get commit metadata + numstat (call 1)
        const metadataResult = await git(
          [
            "log",
            "--format=commit %H%n%B",
            "--numstat",
            "--no-merges",
            resolved,
          ],
          cwd
        );

        // 4. Get per-commit diffs (call 2)
        const diffResult = await git(
          ["log", "-p", "--no-merges", resolved],
          cwd
        );

        // 5. Get overall diff stat
        const statResult = await git(["diff", "--stat", resolved], cwd);

        // Parse commit SHAs and messages from metadata
        const commits: CommitData[] = [];
        const shaList: string[] = [];

        // Extract SHAs from the log
        const shaMatches = metadataResult.stdout.matchAll(
          /^commit ([0-9a-f]{40})$/gm
        );
        for (const match of shaMatches) {
          shaList.push(match[1]!);
        }

        // Parse numstat data
        const numstatMap = parseNumstat(metadataResult.stdout, shaList);

        // Parse per-commit diffs
        const diffMap = parseDiffs(diffResult.stdout, shaList);

        // Extract messages: text between "commit <sha>\n" and the next numstat/commit
        const metaBlocks = metadataResult.stdout
          .split(/^commit /m)
          .filter(Boolean);

        for (const block of metaBlocks) {
          const lines = block.trim().split("\n");
          const sha = lines[0]?.trim();
          if (!sha || !shaList.includes(sha)) continue;

          // Message is lines after SHA until numstat lines start
          const msgLines: string[] = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i]!;
            // numstat lines match "N\tN\t" or "-\t-\t"
            if (/^(\d+|-)\t(\d+|-)\t/.test(line)) break;
            msgLines.push(line);
          }
          const message = msgLines.join("\n").trim();

          const stats = numstatMap.get(sha) ?? { files: [], ins: 0, del: 0 };
          const diff = diffMap.get(sha) ?? "";

          commits.push({
            sha,
            message,
            files_changed: stats.files,
            insertions: stats.ins,
            deletions: stats.del,
            diff,
          });
        }

        const result = {
          range: resolved,
          range_description: description,
          range_resolution: resolution,
          commits,
          diff_stat: statResult.stdout.trim(),
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        // Enrich ref-not-found errors with available branches
        if (
          message.includes("unknown revision") ||
          message.includes("not found")
        ) {
          try {
            const branches = await git(
              ["branch", "--format=%(refname:short)"],
              cwd
            );
            const branchList = branches.stdout.trim();
            if (branchList) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Error: ${message}\nAvailable branches: ${branchList.split("\n").join(", ")}`,
                  },
                ],
                isError: true,
              };
            }
          } catch {
            // Fall through to generic error
          }
        }

        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
