// Shared batch state for the last atomic_commit operation.
// Single-connection assumption: module-level state is safe because
// MCP stdio servers are one-process-per-client-session.

export interface BatchInfo {
  headBefore: string;
  commitCount: number;
  repoToplevel: string;
}

let lastBatchInfo: BatchInfo | null = null;

export function setBatchInfo(info: BatchInfo | null): void {
  lastBatchInfo = info;
}

export function getBatchInfo(): BatchInfo | null {
  return lastBatchInfo;
}
