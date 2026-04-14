import { describe, expect, it } from "vitest";
import { groupRepresentativeFaceIdsByTag } from "./group-rep-similarity-by-tag";

describe("groupRepresentativeFaceIdsByTag", () => {
  it("groups many clusters with the same tag into one batch", () => {
    const clusters = Array.from({ length: 500 }, (_, i) => ({
      clusterId: `c-${i}`,
      representativeFace: { faceInstanceId: `face-${i}` },
    }));
    const getTag = () => "person-a";
    const map = groupRepresentativeFaceIdsByTag(clusters, getTag);
    expect(map.size).toBe(1);
    expect(map.get("person-a")?.length).toBe(500);
  });

  it("partitions by distinct tag", () => {
    const clusters = [
      { clusterId: "c1", representativeFace: { faceInstanceId: "f1" } },
      { clusterId: "c2", representativeFace: { faceInstanceId: "f2" } },
      { clusterId: "c3", representativeFace: { faceInstanceId: "f3" } },
    ];
    const tags: Record<string, string> = { c1: "t1", c2: "t1", c3: "t2" };
    const map = groupRepresentativeFaceIdsByTag(clusters, (id) => tags[id]);
    expect(map.size).toBe(2);
    expect(map.get("t1")?.map((x) => x.clusterId).sort()).toEqual(["c1", "c2"]);
    expect(map.get("t2")?.[0]?.clusterId).toBe("c3");
  });

  it("skips clusters without representative or tag", () => {
    const clusters = [
      { clusterId: "a", representativeFace: { faceInstanceId: "f1" } },
      { clusterId: "b", representativeFace: null },
      { clusterId: "c", representativeFace: { faceInstanceId: "f3" } },
    ];
    const map = groupRepresentativeFaceIdsByTag(clusters, (id) => (id === "a" ? "t" : id === "c" ? "t" : undefined));
    expect(map.get("t")?.length).toBe(2);
  });
});
