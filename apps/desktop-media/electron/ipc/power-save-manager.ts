import { powerSaveBlocker } from "electron";
import { logVerbose } from "../verbose-electron-logs";

type PowerSaveToken = string;

const activeTokens = new Map<PowerSaveToken, string>();
let blockerId: number | null = null;

function ensureBlockerStarted(): void {
  if (blockerId != null && powerSaveBlocker.isStarted(blockerId)) {
    return;
  }
  blockerId = powerSaveBlocker.start("prevent-app-suspension");
  logVerbose(`[power-save] blocker started id=${blockerId}`);
}

function ensureBlockerStopped(): void {
  if (blockerId == null) {
    return;
  }
  const stopped = powerSaveBlocker.stop(blockerId);
  logVerbose(`[power-save] blocker stop requested id=${blockerId} stopped=${stopped}`);
  blockerId = null;
}

export function acquirePowerSave(reason: string): PowerSaveToken {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  activeTokens.set(token, reason);
  if (activeTokens.size === 1) {
    ensureBlockerStarted();
  }
  logVerbose(
    `[power-save] acquire token=${token} reason=${JSON.stringify(reason)} holders=${activeTokens.size}`,
  );
  return token;
}

export function releasePowerSave(token: PowerSaveToken): void {
  const reason = activeTokens.get(token);
  if (!reason) {
    console.warn(`[power-save] release ignored for unknown token=${token}`);
    return;
  }
  activeTokens.delete(token);
  logVerbose(
    `[power-save] release token=${token} reason=${JSON.stringify(reason)} holders=${activeTokens.size}`,
  );
  if (activeTokens.size === 0) {
    ensureBlockerStopped();
  }
}

export function releaseAllPowerSave(): void {
  if (activeTokens.size > 0) {
    logVerbose(`[power-save] releasing all holders count=${activeTokens.size}`);
  }
  activeTokens.clear();
  ensureBlockerStopped();
}

export function getPowerSaveState(): {
  blockerId: number | null;
  holderCount: number;
  reasons: string[];
} {
  return {
    blockerId,
    holderCount: activeTokens.size,
    reasons: Array.from(activeTokens.values()),
  };
}
