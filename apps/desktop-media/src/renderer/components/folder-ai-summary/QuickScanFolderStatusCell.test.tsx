// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QuickScanFolderStatusCell } from "./QuickScanFolderStatusCell";

describe("QuickScanFolderStatusCell", () => {
  afterEach(cleanup);

  it("renders green check when all media folders have a scan record and no pending file deltas", () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <QuickScanFolderStatusCell
              foldersWithFolderScanRecord={5}
              foldersWithDirectMediaOnDisk={5}
              pendingNewOrModified={0}
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("renders amber 99% when coverage rounds to 100% but new/modified files remain", () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <QuickScanFolderStatusCell
              foldersWithFolderScanRecord={100}
              foldersWithDirectMediaOnDisk={100}
              pendingNewOrModified={2}
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(container.textContent).toContain("99%");
  });

  it("renders red 0% when no folders have a scan record yet", () => {
    render(
      <table>
        <tbody>
          <tr>
            <QuickScanFolderStatusCell
              foldersWithFolderScanRecord={0}
              foldersWithDirectMediaOnDisk={4}
              pendingNewOrModified={0}
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText("0%")).toBeVisible();
  });
});
