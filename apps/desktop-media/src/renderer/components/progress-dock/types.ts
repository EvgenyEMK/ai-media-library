/** TEMPORARY: description embedding backfill — remove after migration */
export interface DescEmbedBackfillState {
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  jobId: string | null;
  processed: number;
  total: number;
  indexed: number;
  skipped: number;
  failed: number;
  error: string | null;
  panelVisible: boolean;
}
