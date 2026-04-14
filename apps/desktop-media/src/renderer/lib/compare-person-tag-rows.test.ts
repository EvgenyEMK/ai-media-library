import { describe, it, expect } from "vitest";
import { comparePersonTagRows } from "./compare-person-tag-rows";

describe("comparePersonTagRows", () => {
  it("orders pinned before unpinned", () => {
    const rows = [
      { pinned: false, label: "Aaron" },
      { pinned: true, label: "Zed" },
      { pinned: false, label: "Bob" },
    ];
    rows.sort(comparePersonTagRows);
    expect(rows.map((r) => r.label)).toEqual(["Zed", "Aaron", "Bob"]);
  });

  it("sorts by label within same pin state", () => {
    const rows = [
      { pinned: true, label: "Morgan" },
      { pinned: true, label: "alex" },
    ];
    rows.sort(comparePersonTagRows);
    expect(rows.map((r) => r.label)).toEqual(["alex", "Morgan"]);
  });
});
