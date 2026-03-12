/**
 * Shared ref validation for git commit ranges.
 * Used by review-commits and generate-changelog tools.
 */

// Allows alphanumerics, dots, slashes, hyphens, tildes (~), and carets (^)
// First character must not be a hyphen (prevents flag injection).
const SAFE_SINGLE_REF = /^[a-zA-Z0-9._\/~^][a-zA-Z0-9._\/~^-]*$/;

export type ParsedRange =
  | { kind: "range"; from: string; to: string }
  | { kind: "single"; ref: string };

/**
 * Structurally validate a git range string.
 *
 * - Rejects three-dot ranges ("...") which have different semantics.
 * - Splits two-dot ranges ("..") and validates each side.
 * - Single refs are validated against SAFE_SINGLE_REF.
 */
export function validateRange(range: string): ParsedRange {
  if (range.includes("...")) {
    throw new Error(
      "Three-dot ranges are not supported. Use SHA1..SHA2 for commit ranges."
    );
  }

  if (range.includes("..")) {
    const dotIndex = range.indexOf("..");
    const from = range.slice(0, dotIndex);
    const to = range.slice(dotIndex + 2);

    if (!from || !to) {
      throw new Error(
        "Invalid range: both sides of '..' are required (e.g., main..HEAD)."
      );
    }
    if (!SAFE_SINGLE_REF.test(from)) {
      throw new Error(`Invalid ref on left side of range: ${from}`);
    }
    if (!SAFE_SINGLE_REF.test(to)) {
      throw new Error(`Invalid ref on right side of range: ${to}`);
    }
    return { kind: "range", from, to };
  }

  if (!SAFE_SINGLE_REF.test(range)) {
    throw new Error(`Invalid ref: ${range}`);
  }
  return { kind: "single", ref: range };
}
