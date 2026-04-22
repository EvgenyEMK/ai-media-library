import { useEffect, useMemo, useState } from "react";
import { formatTimeLeftCompact } from "../../../lib/eta-formatting";

interface ProgressEtaParams {
  running: boolean;
  jobId: string | null;
  processed: number;
  total: number;
}

export function useProgressEta({
  running,
  jobId,
  processed,
  total,
}: ProgressEtaParams): string | null {
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [tickMs, setTickMs] = useState<number>(Date.now());

  useEffect(() => {
    if (!running) {
      setStartedAtMs(null);
      return;
    }
    setStartedAtMs(Date.now());
  }, [running, jobId]);

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = window.setInterval(() => {
      setTickMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  return useMemo(() => {
    if (!running || startedAtMs === null) {
      return null;
    }
    if (!Number.isFinite(total) || total <= 0) {
      return null;
    }
    const clampedProcessed = Math.max(0, Math.min(processed, total));
    if (clampedProcessed <= 0 || clampedProcessed >= total) {
      return null;
    }

    const elapsedSeconds = Math.max(0, (tickMs - startedAtMs) / 1000);
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
      return null;
    }

    const progressRatio = clampedProcessed / total;
    const etaSeconds = elapsedSeconds * ((1 - progressRatio) / progressRatio);
    return formatTimeLeftCompact(etaSeconds);
  }, [running, startedAtMs, tickMs, processed, total]);
}
