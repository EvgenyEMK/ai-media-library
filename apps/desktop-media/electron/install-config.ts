import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

const INSTALL_CONFIG_DIR_NAME = "EMK Desktop Media";
const INSTALL_CONFIG_FILE_NAME = "install-config.ini";
const USER_DATA_CONFIG_FILE_NAME = "install-user-data-path.txt";

function getLegacyInstallConfigFilePath(): string {
  return path.join(app.getPath("appData"), INSTALL_CONFIG_DIR_NAME, USER_DATA_CONFIG_FILE_NAME);
}

function getIniInstallConfigFilePath(): string {
  return path.join(app.getPath("appData"), INSTALL_CONFIG_DIR_NAME, INSTALL_CONFIG_FILE_NAME);
}

function readIniUserDataPath(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  let inPathsSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#")) {
      continue;
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      inPathsSection = trimmed.toLowerCase() === "[paths]";
      continue;
    }
    if (!inPathsSection) {
      continue;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim().toLowerCase();
    if (key !== "userdatapath") {
      continue;
    }
    const value = trimmed.slice(eqIndex + 1).trim();
    return value.length > 0 ? value : null;
  }
  return null;
}

export function resolveInstalledUserDataPath(): string | null {
  const configuredPath = process.env.EMK_DESKTOP_USER_DATA_PATH?.trim();
  if (configuredPath) {
    return configuredPath;
  }
  try {
    const iniConfiguredPath = readIniUserDataPath(getIniInstallConfigFilePath());
    if (iniConfiguredPath) {
      return iniConfiguredPath;
    }

    const configFilePath = getLegacyInstallConfigFilePath();
    if (!fs.existsSync(configFilePath)) {
      return null;
    }
    const rawValue = fs.readFileSync(configFilePath, "utf8").trim();
    return rawValue.length > 0 ? rawValue : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[desktop-install] Failed to read install userData path config: ${message}`);
    return null;
  }
}
