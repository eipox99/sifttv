export const RefreshJobStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
} as const;

export type RefreshJobStatusValue = (typeof RefreshJobStatus)[keyof typeof RefreshJobStatus];
