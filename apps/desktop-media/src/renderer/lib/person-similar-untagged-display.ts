import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";

export type SimilarUntaggedCountsStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export function resolveSimilarUntaggedDisplay(
  row: DesktopPersonTagWithFaceCount,
  similarUntaggedCountsByTagId: Record<string, number>,
  similarUntaggedCountsStatus: SimilarUntaggedCountsStatus,
):
  | { kind: "loading" }
  | { kind: "ready"; value: number }
  | { kind: "fallback"; value: number } {
  const live = similarUntaggedCountsByTagId[row.id];
  if (live !== undefined) {
    return { kind: "ready", value: live };
  }
  if (similarUntaggedCountsStatus === "running") {
    return { kind: "loading" };
  }
  if (similarUntaggedCountsStatus === "failed" || similarUntaggedCountsStatus === "cancelled") {
    return { kind: "fallback", value: row.similarFaceCount };
  }
  return { kind: "fallback", value: row.similarFaceCount };
}
