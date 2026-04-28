import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAlreadyAnalyzedPhotoPaths,
  getAlreadyFaceDetectedPhotoPaths,
  mergeRotationEditSuggestion,
  parseAiVisionLocation,
  upsertPhotoAnalysisResult,
} from "./media-analysis";
import { __closeDesktopDatabaseForTesting, getDesktopDatabase, initDesktopDatabase } from "./client";
import type { FaceOrientationMetadata } from "@emk/media-metadata-core";
import type { PhotoAnalysisOutput } from "../../src/shared/ipc";

function canOpenSqlite(): boolean {
  let probeDir: string | null = null;
  try {
    probeDir = fs.mkdtempSync(path.join(os.tmpdir(), "emk-sqlite-probe-"));
    initDesktopDatabase(probeDir);
    __closeDesktopDatabaseForTesting();
    return true;
  } catch {
    return false;
  } finally {
    __closeDesktopDatabaseForTesting();
    if (probeDir) {
      fs.rmSync(probeDir, { recursive: true, force: true });
    }
  }
}

const HAS_SQLITE = canOpenSqlite();

function photoAnalysisFixture(input: {
  image_category: string;
  title: string;
  description: string;
  location?: string | null;
}): PhotoAnalysisOutput {
  return {
    ...input,
    modelInfo: {
      model: "test-model",
      promptVersion: "test-prompt",
      timestamp: "2026-01-01T00:00:00.000Z",
    },
  };
}

describe("mergeRotationEditSuggestion", () => {
  it("returns null when there is nothing to add and no existing entries", () => {
    expect(mergeRotationEditSuggestion(null, null, "face_landmarks")).toBe(null);
  });

  it("returns null when orientation correction is 0 and no existing entries", () => {
    const upright: FaceOrientationMetadata = {
      orientation: "upright",
      correction_angle_clockwise: 0,
      confidence: 0.9,
      face_count: 3,
    };
    expect(mergeRotationEditSuggestion(null, upright, "face_landmarks")).toBe(null);
  });

  it("adds a rotation suggestion when correction angle is non-zero", () => {
    const rotation: FaceOrientationMetadata = {
      orientation: "rotated_90_cw",
      correction_angle_clockwise: 90,
      confidence: 0.8,
      face_count: 2,
    };
    const result = mergeRotationEditSuggestion(null, rotation, "face_landmarks");
    expect(result).toHaveLength(1);
    const entry = (result as Record<string, unknown>[])[0];
    expect(entry.edit_type).toBe("rotate");
    expect(entry.source).toBe("face_landmarks");
    expect((entry.rotation as Record<string, unknown>).angle_degrees_clockwise).toBe(90);
  });

  it("replaces a previous face-detection rotation entry without touching other edits", () => {
    const existing = [
      { edit_type: "rotate", source: "face_landmarks", rotation: { angle_degrees_clockwise: 90 } },
      { edit_type: "crop", source: "photo-analysis", reason: "zoom" },
    ];
    const rotation: FaceOrientationMetadata = {
      orientation: "rotated_180",
      correction_angle_clockwise: 180,
      confidence: 0.7,
      face_count: 1,
    };
    const result = mergeRotationEditSuggestion(existing, rotation, "face_landmarks");
    expect(result).toHaveLength(2);
    const types = (result as Record<string, unknown>[]).map((e) => e.edit_type);
    expect(types).toContain("crop");
    const rotEntry = (result as Record<string, unknown>[]).find(
      (e) => e.edit_type === "rotate",
    );
    expect(rotEntry?.source).toBe("face_landmarks");
    expect((rotEntry?.rotation as Record<string, unknown>).angle_degrees_clockwise).toBe(180);
  });

  it("keeps other rotation sources (e.g. photo-analysis) intact", () => {
    const existing = [
      {
        edit_type: "rotate",
        source: "photo-analysis",
        rotation: { angle_degrees_clockwise: 270 },
      },
    ];
    const rotation: FaceOrientationMetadata = {
      orientation: "rotated_90_cw",
      correction_angle_clockwise: 90,
      confidence: 0.5,
      face_count: 1,
    };
    const result = mergeRotationEditSuggestion(existing, rotation, "face_landmarks");
    expect(result).toHaveLength(2);
    const bySource = new Map(
      (result as Record<string, unknown>[]).map((e) => [e.source, e]),
    );
    expect(bySource.has("photo-analysis")).toBe(true);
    expect(bySource.has("face_landmarks")).toBe(true);
  });

  it("removes a previous face-detection rotation when no correction is needed", () => {
    const existing = [
      { edit_type: "rotate", source: "face_landmarks", rotation: { angle_degrees_clockwise: 90 } },
      { edit_type: "rotate", source: "photo-analysis", rotation: { angle_degrees_clockwise: 90 } },
    ];
    const upright: FaceOrientationMetadata = {
      orientation: "upright",
      correction_angle_clockwise: 0,
      confidence: 0.95,
      face_count: 4,
    };
    const result = mergeRotationEditSuggestion(existing, upright, "face_landmarks");
    expect(result).toHaveLength(1);
    expect(((result as Record<string, unknown>[])[0]).source).toBe("photo-analysis");
  });
});

describe("parseAiVisionLocation", () => {
  it("parses the current VLM prompt format as country, then city", () => {
    expect(parseAiVisionLocation("United States, New York City")).toEqual({
      country: "United States",
      city: "New York City",
      placeName: null,
      raw: "United States, New York City",
    });
  });

  it("keeps extra location parts as a place name", () => {
    expect(parseAiVisionLocation("United States, New York City, Times Square")).toEqual({
      country: "United States",
      city: "New York City",
      placeName: "Times Square",
      raw: "United States, New York City, Times Square",
    });
  });

  it("strips model-emitted labels and null placeholders", () => {
    expect(parseAiVisionLocation("Country: Switzerland, City: Zurich")).toEqual({
      country: "Switzerland",
      city: "Zurich",
      placeName: null,
      raw: "Country: Switzerland, City: Zurich",
    });
    expect(parseAiVisionLocation("Switzerland, null")).toEqual({
      country: "Switzerland",
      city: null,
      placeName: null,
      raw: "Switzerland, null",
    });
  });

  it("repairs reversed city-country output when the country is recognizable", () => {
    expect(parseAiVisionLocation("Milan, Italy")).toEqual({
      country: "Italy",
      city: "Milan",
      placeName: null,
      raw: "Milan, Italy",
    });
  });

  it("does not guess country or city from a single ambiguous value", () => {
    expect(parseAiVisionLocation("Times Square")).toEqual({
      country: null,
      city: null,
      placeName: null,
      raw: "Times Square",
    });
  });
});

describe.skipIf(!HAS_SQLITE)("upsertPhotoAnalysisResult location persistence", () => {
  let tmpDir = "";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emk-media-analysis-"));
    initDesktopDatabase(tmpDir);
  });

  afterEach(() => {
    __closeDesktopDatabaseForTesting();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("stores current VLM location output in separate country and city fields", () => {
    const id = upsertPhotoAnalysisResult("C:/photos/times-square.jpg", photoAnalysisFixture({
      image_category: "architecture",
      title: "Times Square",
      description: "A busy city square with billboards.",
      location: "United States, New York City",
    }));

    const row = getDesktopDatabase()
      .prepare(
        `SELECT country, city, location_source, ai_metadata
         FROM media_items
         WHERE id = ?`,
      )
      .get(id) as {
      country: string | null;
      city: string | null;
      location_source: string | null;
      ai_metadata: string;
    };
    const metadata = JSON.parse(row.ai_metadata) as {
      image_analysis?: {
        location?: {
          country?: string | null;
          city?: string | null;
          source?: string;
        };
      };
    };

    expect(row.country).toBe("United States");
    expect(row.city).toBe("New York City");
    expect(row.location_source).toBe("ai_vision");
    expect(metadata.image_analysis?.location).toMatchObject({
      country: "United States",
      city: "New York City",
      source: "ai",
    });
  });

  it("does not overwrite GPS catalog location fields with AI location", () => {
    const now = "2026-01-01T00:00:00.000Z";
    const db = getDesktopDatabase();
    db.prepare(
      `INSERT INTO media_items (
        id, library_id, source_path, filename, country, city, location_area, location_source,
        created_at, updated_at
      ) VALUES ('gps-item', 'local-default', ?, 'gps.jpg', 'Germany', 'Berlin', 'Berlin', 'gps', ?, ?)`,
    ).run("C:/photos/gps.jpg", now, now);

    upsertPhotoAnalysisResult("C:/photos/gps.jpg", photoAnalysisFixture({
      image_category: "architecture",
      title: "Times Square",
      description: "A busy city square with billboards.",
      location: "United States, New York City",
    }));

    const row = db
      .prepare(
        `SELECT country, city, location_area, location_source, ai_metadata
         FROM media_items
         WHERE id = 'gps-item'`,
      )
      .get() as {
      country: string | null;
      city: string | null;
      location_area: string | null;
      location_source: string | null;
      ai_metadata: string;
    };

    expect(row.country).toBe("Germany");
    expect(row.city).toBe("Berlin");
    expect(row.location_area).toBe("Berlin");
    expect(row.location_source).toBe("gps");
    expect(JSON.parse(row.ai_metadata)).toMatchObject({
      image_analysis: {
        location: {
          country: "United States",
          city: "New York City",
          source: "ai",
        },
      },
    });
  });

  it("does not treat a photo-analysis result as current when a newer failure exists", () => {
    const db = getDesktopDatabase();
    const pathWithLaterFailure = "C:/photos/later-failure.jpg";
    const pathWithLaterSuccess = "C:/photos/later-success.jpg";
    const aiMetadata = JSON.stringify({
      image_analysis: {
        image_category: "landscape",
        title: "Alpine Lake",
        description: "A lake in the mountains.",
      },
    });

    db.prepare(
      `INSERT INTO media_items (
        id, library_id, source_path, filename, ai_metadata,
        photo_analysis_processed_at, photo_analysis_failed_at, created_at, updated_at
      ) VALUES (?, 'local-default', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "photo-later-failure",
      pathWithLaterFailure,
      "later-failure.jpg",
      aiMetadata,
      "2026-01-01T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
    );
    db.prepare(
      `INSERT INTO media_items (
        id, library_id, source_path, filename, ai_metadata,
        photo_analysis_processed_at, photo_analysis_failed_at, created_at, updated_at
      ) VALUES (?, 'local-default', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "photo-later-success",
      pathWithLaterSuccess,
      "later-success.jpg",
      aiMetadata,
      "2026-01-03T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
      "2026-01-03T00:00:00.000Z",
    );

    const analyzed = getAlreadyAnalyzedPhotoPaths("", [
      pathWithLaterFailure,
      pathWithLaterSuccess,
    ]);

    expect(analyzed.has(pathWithLaterFailure)).toBe(false);
    expect(analyzed.has(pathWithLaterSuccess)).toBe(true);
  });

  it("does not treat a face-detection result as current when a newer failure exists", () => {
    const db = getDesktopDatabase();
    const pathWithLaterFailure = "C:/photos/face-later-failure.jpg";
    const pathWithLaterSuccess = "C:/photos/face-later-success.jpg";

    db.prepare(
      `INSERT INTO media_items (
        id, library_id, source_path, filename,
        face_detection_processed_at, face_detection_failed_at, created_at, updated_at
      ) VALUES (?, 'local-default', ?, ?, ?, ?, ?, ?)`,
    ).run(
      "face-later-failure",
      pathWithLaterFailure,
      "face-later-failure.jpg",
      "2026-01-01T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
    );
    db.prepare(
      `INSERT INTO media_items (
        id, library_id, source_path, filename,
        face_detection_processed_at, face_detection_failed_at, created_at, updated_at
      ) VALUES (?, 'local-default', ?, ?, ?, ?, ?, ?)`,
    ).run(
      "face-later-success",
      pathWithLaterSuccess,
      "face-later-success.jpg",
      "2026-01-03T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
      "2026-01-03T00:00:00.000Z",
    );

    const detected = getAlreadyFaceDetectedPhotoPaths("", [
      pathWithLaterFailure,
      pathWithLaterSuccess,
    ]);

    expect(detected.has(pathWithLaterFailure)).toBe(false);
    expect(detected.has(pathWithLaterSuccess)).toBe(true);
  });
});
