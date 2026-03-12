export interface Hunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
  context: string;
}

export interface FileDiff {
  path: string;
  hunks: Hunk[];
}

const HUNK_HEADER_RE =
  /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/;

export function parseDiff(diffOutput: string): FileDiff[] {
  if (!diffOutput.trim()) return [];

  const files: FileDiff[] = [];
  const fileSections = diffOutput.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    const fullSection = "diff --git " + section;
    const lines = fullSection.split("\n");

    const pathMatch = lines[0].match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (!pathMatch) continue;

    const path = pathMatch[2];
    const hunks: Hunk[] = [];

    let i = 1;
    while (i < lines.length && !lines[i].startsWith("@@")) {
      i++;
    }

    while (i < lines.length) {
      const line = lines[i];
      const headerMatch = line.match(HUNK_HEADER_RE);
      if (!headerMatch) {
        i++;
        continue;
      }

      const header = line;
      const oldStart = parseInt(headerMatch[1], 10);
      const oldCount =
        headerMatch[2] !== undefined ? parseInt(headerMatch[2], 10) : 1;
      const newStart = parseInt(headerMatch[3], 10);
      const newCount =
        headerMatch[4] !== undefined ? parseInt(headerMatch[4], 10) : 1;
      const context = (headerMatch[5] ?? "").trim();

      i++;
      const hunkLines: string[] = [];

      while (
        i < lines.length &&
        !lines[i].startsWith("@@") &&
        !lines[i].startsWith("diff --git ")
      ) {
        hunkLines.push(lines[i]);
        i++;
      }

      hunks.push({
        header,
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: hunkLines,
        context,
      });
    }

    files.push({ path, hunks });
  }

  return files;
}

/**
 * Reconstruct a minimal patch containing only selected hunks for a single file.
 * The diffOutput should be the full diff for one file (from `git diff -- <path>`).
 */
export function buildPartialPatch(
  fullFileDiff: string,
  selectedHunkIndices: number[]
): string {
  const lines = fullFileDiff.split("\n");

  const headerLines: string[] = [];
  let i = 0;
  while (i < lines.length && !lines[i].startsWith("@@")) {
    headerLines.push(lines[i]);
    i++;
  }

  const parsed = parseDiff(fullFileDiff);
  if (parsed.length === 0) return "";

  const fileDiff = parsed[0];
  const selectedHunks = selectedHunkIndices
    .filter((idx) => idx >= 0 && idx < fileDiff.hunks.length)
    .map((idx) => fileDiff.hunks[idx]);

  if (selectedHunks.length === 0) return "";

  const patchLines = [...headerLines];
  for (const hunk of selectedHunks) {
    patchLines.push(hunk.header);
    patchLines.push(...hunk.lines);
  }

  const patch = patchLines.join("\n");
  return patch.endsWith("\n") ? patch : patch + "\n";
}
