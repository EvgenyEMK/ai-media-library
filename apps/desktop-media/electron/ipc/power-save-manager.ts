import { powerSaveBlocker } from "electron";
import { isVerboseElectronLogsEnabled } from "../verbose-electron-logs";

type PowerSaveToken = string;

const consoleLog = console.log.bind(console);

function logPowerSave(...args: Parameters<typeof console.log>): void {
  if (!isVerboseElectronLogsEnabled()) return;
  consoleLog(...args);
}

const activeTokens = new Map<PowerSaveToken, string>();
let blockerId: number | null = null;

function ensureBlockerStarted(): void {
  if (blockerId != null && powerSaveBlocker.isStarted(blockerId)) {
    return;
  }
  blockerId = powerSaveBlocker.start("prevent-app-suspension");
  logPowerSave(`[power-save] blocker started id=${blockerId}`);
}

function ensureBlockerStopped(): void {
  if (blockerId == null) {
    return;
  }
  const stopped = powerSaveBlocker.stop(blockerId);
  logPowerSave(`[power-save] blocker stop requested id=${blockerId} stopped=${stopped}`);
  blockerId = null;
}

export function acquirePowerSave(reason: string): PowerSaveToken {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  activeTokens.set(token, reason);
  if (activeTokens.size === 1) {
    ensureBlockerStarted();
  }
  logPowerSave(
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
  logPowerSave(
    `[power-save] release token=${token} reason=${JSON.stringify(reason)} holders=${activeTokens.size}`,
  );
  if (activeTokens.size === 0) {
    ensureBlockerStopped();
  }
}

export function releaseAllPowerSave(): void {
  if (activeTokens.size > 0) {
    logPowerSave(`[power-save] releasing all holders count=${activeTokens.size}`);
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
