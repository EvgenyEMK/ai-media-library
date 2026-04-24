import type { PhotoAnalysisOutput, PhotoEditSuggestion, RelativeCropBox } from "../src/shared/ipc";

export function parseAnalysisJson(content: string): Omit<PhotoAnalysisOutput, "modelInfo"> {
  const normalized = extractJsonCandidate(content);

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(normalized);
  } catch {
    console.error("[photo-ai] Model response is not valid JSON", {
      rawModelOutput: content,
      jsonParseCandidate: normalized,
    });
    throw new Error("Model response is not valid JSON");
  }

  if (!isObject(parsedValue)) {
    throw new Error("Model response JSON must be an object");
  }

  const image_category =
    typeof parsedValue.image_category === "string"
      ? parsedValue.image_category.trim()
      : "";
  const title = typeof parsedValue.title === "string" ? parsedValue.title.trim() : "";
  const description =
    typeof parsedValue.description === "string" ? parsedValue.description.trim() : "";

  if (!image_category || !title || !description) {
    throw new Error("Model response is missing required fields");
  }

  const hasChildOrChildren = ensureNullableBoolean(parsedValue.has_child_or_children);
  const hasChildren = ensureNullableBoolean(parsedValue.has_children);
  const knownKeys = new Set([
    "image_category",
    "title",
    "description",
    "number_of_people",
    "has_children",
    "has_child_or_children",
    "people",
    "location",
    "date",
    "time",
    "weather",
    "daytime",
    "photo_estetic_quality",
    // Keep as known legacy key so it is dropped from extras if model still emits it.
    "star_rating_1_5",
    "is_low_quality",
    "quality_issues",
    "edit_suggestions",
  ]);
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsedValue)) {
    if (!knownKeys.has(key) && value !== undefined) {
      extras[key] = value;
    }
  }

  return {
    image_category,
    title,
    description,
    number_of_people: ensureNullableNumber(parsedValue.number_of_people),
    has_children: hasChildOrChildren ?? hasChildren,
    people: ensurePeopleArray(parsedValue.people),
    location: ensureNullableString(parsedValue.location),
    date: ensureNullableString(parsedValue.date),
    time: ensureNullableString(parsedValue.time),
    weather: ensureNullableString(parsedValue.weather),
    daytime: ensureNullableString(parsedValue.daytime),
    photo_estetic_quality: ensureNullableNumber(parsedValue.photo_estetic_quality),
    is_low_quality: ensureNullableBoolean(parsedValue.is_low_quality),
    quality_issues: ensureNullableStringArray(parsedValue.quality_issues),
    edit_suggestions: ensureEditSuggestions(parsedValue.edit_suggestions),
    ...extras,
  };
}

function extractJsonCandidate(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (blockMatch?.[1]) {
    return blockMatch[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

export function ensureNullableString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return null;
}

export function ensureNullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function ensureNullableBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function ensureNullableStringArray(value: unknown): string[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const result = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return result;
}

function ensurePeopleArray(value: unknown): PhotoAnalysisOutput["people"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!isObject(item)) {
        return null;
      }

      const personCategory =
        typeof item.person_category === "string"
          ? item.person_category.trim()
          : undefined;
      const gender = typeof item.gender === "string" ? item.gender.trim() : undefined;
      const averageAge = ensureNullableNumber(item.average_age);

      const candidate: NonNullable<PhotoAnalysisOutput["people"]>[number] = {
        person_category:
          personCategory === "adult" ||
          personCategory === "child" ||
          personCategory === "baby"
            ? personCategory
            : null,
        gender:
          gender === "male" ||
          gender === "female" ||
          gender === "unknown" ||
          gender === "other"
            ? gender
            : null,
        average_age: averageAge === undefined ? null : averageAge,
      };
      return candidate;
    })
    .filter((item): item is NonNullable<PhotoAnalysisOutput["people"]>[number] => item !== null);
}

function ensureEditSuggestions(value: unknown): PhotoEditSuggestion[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const suggestions: PhotoEditSuggestion[] = [];
  for (const item of value) {
    if (!isObject(item)) {
      continue;
    }
    const itemSuggestions: PhotoEditSuggestion[] = [];
    const primary = parseEditSuggestion(item);
    if (primary) {
      itemSuggestions.push(primary);
    }

    if (parseRotation(item.rotation) && !itemSuggestions.some((entry) => entry.edit_type === "rotate")) {
      const rotateSuggestion = parseEditSuggestionByType(item, "rotate");
      if (rotateSuggestion) {
        itemSuggestions.push(rotateSuggestion);
      }
    }
    if (
      parseRelativeCropBox(item.crop_rel) &&
      !itemSuggestions.some((entry) => entry.edit_type === "crop")
    ) {
      const cropSuggestion = parseEditSuggestionByType(item, "crop");
      if (cropSuggestion) {
        itemSuggestions.push(cropSuggestion);
      }
    }

    suggestions.push(...itemSuggestions);
  }

  return dedupeEditSuggestions(suggestions);
}

function parseEditSuggestion(value: unknown): PhotoEditSuggestion | null {
  if (!isObject(value) || typeof value.edit_type !== "string") {
    return null;
  }
  const editType = value.edit_type.trim().toLowerCase();
  if (!isSupportedEditType(editType)) {
    return null;
  }
  return parseEditSuggestionByType(value, editType);
}

function parseEditSuggestionByType(
  value: Record<string, unknown>,
  editType: PhotoEditSuggestion["edit_type"],
): PhotoEditSuggestion | null {
  const suggestion: PhotoEditSuggestion = { edit_type: editType };
  suggestion.priority = ensurePriority(value.priority);
  suggestion.reason = ensureNullableString(value.reason);
  suggestion.confidence = ensureBoundedNumber(value.confidence, 0, 1);
  suggestion.auto_apply_safe = ensureNullableBoolean(value.auto_apply_safe);

  if (editType === "rotate") {
    const rotation = parseRotation(value.rotation);
    if (!rotation) {
      return null;
    }
    suggestion.rotation = rotation;
  } else if (editType === "crop") {
    const crop = parseRelativeCropBox(value.crop_rel);
    if (!crop) {
      return null;
    }
    suggestion.crop_rel = crop;
    suggestion.crop_target = ensureCropTarget(value.crop_target);
  } else if (editType === "straighten") {
    const angle = ensureBoundedNumber(
      isObject(value.straighten) ? value.straighten.angle_degrees : undefined,
      -15,
      15,
    );
    if (angle === undefined || angle === null) {
      return null;
    }
    suggestion.straighten = { angle_degrees: angle };
  } else if (editType === "exposure_fix") {
    const evDelta = ensureBoundedNumber(
      isObject(value.exposure_fix) ? value.exposure_fix.ev_delta : undefined,
      -1.5,
      1.5,
    );
    if (evDelta === undefined || evDelta === null) {
      return null;
    }
    suggestion.exposure_fix = { ev_delta: evDelta };
  } else if (editType === "white_balance_fix") {
    const payload = isObject(value.white_balance_fix) ? value.white_balance_fix : null;
    const temperatureDelta = ensureBoundedNumber(payload?.temperature_delta, -100, 100);
    const tintDelta = ensureBoundedNumber(payload?.tint_delta, -100, 100);
    if (temperatureDelta === undefined && tintDelta === undefined) {
      return null;
    }
    suggestion.white_balance_fix = {
      temperature_delta: temperatureDelta,
      tint_delta: tintDelta,
    };
  } else if (editType === "contrast_fix") {
    const contrastDelta = ensureBoundedNumber(
      isObject(value.contrast_fix) ? value.contrast_fix.contrast_delta : undefined,
      -100,
      100,
    );
    if (contrastDelta === undefined || contrastDelta === null) {
      return null;
    }
    suggestion.contrast_fix = { contrast_delta: contrastDelta };
  } else if (editType === "denoise") {
    const strength = ensureBoundedNumber(
      isObject(value.denoise) ? value.denoise.strength_0_1 : undefined,
      0,
      1,
    );
    if (strength === undefined || strength === null) {
      return null;
    }
    suggestion.denoise = { strength_0_1: strength };
  } else if (editType === "sharpen") {
    const strength = ensureBoundedNumber(
      isObject(value.sharpen) ? value.sharpen.strength_0_1 : undefined,
      0,
      1,
    );
    if (strength === undefined || strength === null) {
      return null;
    }
    suggestion.sharpen = { strength_0_1: strength };
  }

  return suggestion;
}

function dedupeEditSuggestions(suggestions: PhotoEditSuggestion[]): PhotoEditSuggestion[] {
  const deduped: PhotoEditSuggestion[] = [];
  const keys = new Set<string>();

  for (const suggestion of suggestions) {
    const key = JSON.stringify({
      edit_type: suggestion.edit_type,
      rotation: suggestion.rotation ?? null,
      crop_rel: suggestion.crop_rel ?? null,
      crop_target: suggestion.crop_target ?? null,
      straighten: suggestion.straighten ?? null,
      exposure_fix: suggestion.exposure_fix ?? null,
      white_balance_fix: suggestion.white_balance_fix ?? null,
      contrast_fix: suggestion.contrast_fix ?? null,
      denoise: suggestion.denoise ?? null,
      sharpen: suggestion.sharpen ?? null,
    });
    if (keys.has(key)) {
      continue;
    }
    keys.add(key);
    deduped.push(suggestion);
  }

  return deduped;
}

function isSupportedEditType(value: string): value is PhotoEditSuggestion["edit_type"] {
  return (
    value === "rotate" ||
    value === "crop" ||
    value === "straighten" ||
    value === "exposure_fix" ||
    value === "contrast_fix" ||
    value === "white_balance_fix" ||
    value === "denoise" ||
    value === "sharpen"
  );
}

function ensurePriority(
  value: unknown,
): "high" | "medium" | "low" | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return null;
}

function ensureBoundedNumber(
  value: unknown,
  min: number,
  max: number,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
}

function parseRotation(value: unknown): PhotoEditSuggestion["rotation"] | null {
  if (!isObject(value)) {
    return null;
  }
  const observedOrientation = parseObservedOrientation(value.observed_orientation);
  const explicitAngle = parseRotationAngle(value.angle_degrees_clockwise);
  const mappedAngle = mapObservedOrientationToAngle(observedOrientation);
  const angle = explicitAngle ?? mappedAngle;
  if (angle === null) {
    return null;
  }

  const confidenceOrientation = ensureBoundedNumber(value.confidence_orientation, 0, 1);
  return {
    observed_orientation: observedOrientation ?? undefined,
    confidence_orientation:
      confidenceOrientation === undefined ? undefined : confidenceOrientation,
    angle_degrees_clockwise: angle,
  };
}

function parseRelativeCropBox(value: unknown): RelativeCropBox | null {
  if (!isObject(value)) {
    return null;
  }
  const x = ensureNormalizedWithTolerance(value.x);
  const y = ensureNormalizedWithTolerance(value.y);
  const width = ensureNormalizedWithTolerance(value.width);
  const height = ensureNormalizedWithTolerance(value.height);
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    x === null ||
    y === null ||
    width === null ||
    height === null
  ) {
    return null;
  }
  if (width <= 0 || height <= 0) {
    return null;
  }
  const epsilon = 0.02;
  if (x + width > 1 + epsilon || y + height > 1 + epsilon) {
    return null;
  }
  const clampedWidth = Math.max(0, Math.min(width, 1 - x));
  const clampedHeight = Math.max(0, Math.min(height, 1 - y));
  if (clampedWidth <= 0 || clampedHeight <= 0) {
    return null;
  }
  return { x, y, width: clampedWidth, height: clampedHeight };
}

function ensureNormalizedWithTolerance(value: unknown): number | null | undefined {
  const parsed = ensureNullableNumber(value);
  if (parsed === undefined || parsed === null) {
    return parsed;
  }

  const epsilon = 0.02;
  if (parsed < -epsilon || parsed > 1 + epsilon) {
    return null;
  }
  return Math.max(0, Math.min(1, parsed));
}

function parseObservedOrientation(
  value: unknown,
): NonNullable<PhotoEditSuggestion["rotation"]>["observed_orientation"] {
  if (
    value === "upright" ||
    value === "rotated_90_cw" ||
    value === "rotated_180" ||
    value === "rotated_270_cw" ||
    value === "uncertain"
  ) {
    return value;
  }
  return null;
}

function mapObservedOrientationToAngle(
  value: NonNullable<PhotoEditSuggestion["rotation"]>["observed_orientation"],
): 90 | 180 | 270 | null {
  if (value === "rotated_90_cw") {
    return 270;
  }
  if (value === "rotated_180") {
    return 180;
  }
  if (value === "rotated_270_cw") {
    return 90;
  }
  return null;
}

function parseRotationAngle(value: unknown): 90 | 180 | 270 | null {
  const parsed = ensureNullableNumber(value);
  const normalizedValue =
    parsed !== null && parsed !== undefined
      ? parsed
      : typeof value === "string"
        ? Number.parseFloat(value)
        : NaN;

  if (!Number.isFinite(normalizedValue)) {
    return null;
  }
  if (normalizedValue === 90) {
    return 90;
  }
  if (normalizedValue === 180) {
    return 180;
  }
  if (normalizedValue === 270) {
    return 270;
  }
  if (normalizedValue === -90) {
    return 270;
  }
  return null;
}

function ensureCropTarget(
  value: unknown,
): "document" | "subject" | "horizon_fix" | "other" | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (
    value === "document" ||
    value === "subject" ||
    value === "horizon_fix" ||
    value === "other"
  ) {
    return value;
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
