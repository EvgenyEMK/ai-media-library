import { beforeEach, describe, expect, it, vi } from "vitest";

const existsSyncMock = vi.fn<(path: string) => boolean>();
const readFileSyncMock = vi.fn<(path: string, encoding: BufferEncoding) => string>();
const getPathMock = vi.fn<(name: string) => string>();

vi.mock("node:fs", () => ({
  default: {
    existsSync: existsSyncMock,
    readFileSync: readFileSyncMock,
  },
}));

vi.mock("electron", () => ({
  app: {
    getPath: getPathMock,
  },
}));

describe("resolveInstalledUserDataPath", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.EMK_DESKTOP_USER_DATA_PATH;
    getPathMock.mockReturnValue("C:/Users/test/AppData/Roaming");
  });

  it("returns env override when provided", async () => {
    process.env.EMK_DESKTOP_USER_DATA_PATH = "D:/custom-data";
    const { resolveInstalledUserDataPath } = await import("./install-config");
    expect(resolveInstalledUserDataPath()).toBe("D:/custom-data");
  });

  it("reads and trims persisted install path from config file", async () => {
    existsSyncMock.mockImplementation((filePath) => filePath.endsWith("install-config.ini"));
    readFileSyncMock.mockImplementation((filePath) => {
      if (filePath.endsWith("install-config.ini")) {
        return "[Paths]\r\nUserDataPath=E:/media-db\r\n";
      }
      return "";
    });
    const { resolveInstalledUserDataPath } = await import("./install-config");
    expect(resolveInstalledUserDataPath()).toBe("E:/media-db");
  });

  it("falls back to legacy txt config file when ini is missing", async () => {
    existsSyncMock.mockImplementation((filePath) => filePath.endsWith("install-user-data-path.txt"));
    readFileSyncMock.mockImplementation((filePath) => {
      if (filePath.endsWith("install-user-data-path.txt")) {
        return "F:/legacy-media-db\r\n";
      }
      return "";
    });
    const { resolveInstalledUserDataPath } = await import("./install-config");
    expect(resolveInstalledUserDataPath()).toBe("F:/legacy-media-db");
  });

  it("returns null when no persisted config exists", async () => {
    existsSyncMock.mockReturnValue(false);
    const { resolveInstalledUserDataPath } = await import("./install-config");
    expect(resolveInstalledUserDataPath()).toBeNull();
  });
});
