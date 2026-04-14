import { describe, expect, it } from "vitest";
import {
  buildPathLlmOllamaChatBody,
  inferDatePrecision,
  unwrapPathLlmChatJsonToArray,
} from "./llm-path-analyzer";

describe("unwrapPathLlmChatJsonToArray", () => {
  it("passes through arrays", () => {
    const a = [{ index: 1 }];
    expect(unwrapPathLlmChatJsonToArray(a, 99)).toBe(a);
  });

  it("unwraps results wrapper", () => {
    const inner = [{ index: 1 }];
    expect(unwrapPathLlmChatJsonToArray({ results: inner }, 99)).toBe(inner);
  });

  it("unwraps files wrapper", () => {
    const inner = [{ index: 1 }];
    expect(unwrapPathLlmChatJsonToArray({ files: inner }, 99)).toBe(inner);
  });

  it("returns null for objects without a known array field", () => {
    expect(unwrapPathLlmChatJsonToArray({ foo: [1], bar: "x" }, 1)).toBeNull();
  });

  it("wraps a single path item object only when batch size is 1", () => {
    const one = {
      index: 1,
      date: { start: "2002-05-09", end: null, precision: "day" as const },
      location: null,
      display_title: "Title",
    };
    expect(unwrapPathLlmChatJsonToArray(one, 1)).toEqual([one]);
  });

  it("does not wrap one object as a full multi-file batch", () => {
    const one = {
      index: 1,
      date: null,
      location: null,
      display_title: "x",
    };
    expect(unwrapPathLlmChatJsonToArray(one, 15)).toBeNull();
  });
});

describe("buildPathLlmOllamaChatBody", () => {
  it("uses format json for a single path", () => {
    const body = buildPathLlmOllamaChatBody(["C:\\a\\b.jpg"], 0, "m");
    expect(body.format).toBe("json");
    expect(body.messages).toHaveLength(2);
    const system = body.messages.find((x) => x.role === "system")?.content ?? "";
    expect(system).not.toContain("\"names\"");
    expect(system).not.toContain("\"place_name\"");
    expect(system).toContain("prioritize it over similar data in folder path");
    expect(system).toContain("inconsistent (example: \"Germany\", \"Paris\")");
  });

  it("uses JSON Schema array for multiple paths with matching min/max items", () => {
    const paths = ["C:\\a\\1.jpg", "C:\\a\\2.jpg"];
    const body = buildPathLlmOllamaChatBody(paths, 0, "m");
    expect(body.format).toEqual({
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: { type: "object", additionalProperties: true },
    });
    const user = body.messages.find((x) => x.role === "user")?.content ?? "";
    expect(user).toContain("exactly 2 objects");
  });
});

describe("inferDatePrecision", () => {
  it("infers year", () => {
    expect(inferDatePrecision("2002", null)).toBe("year");
  });

  it("infers month", () => {
    expect(inferDatePrecision("2002-05", null)).toBe("month");
  });

  it("infers day for full date", () => {
    expect(inferDatePrecision("2002-05-09", null)).toBe("day");
  });
});
