/**
 * Automated regression test for AI rotation detection.
 *
 * Uses the EXACT same `analyzePhotoWithOptionalTwoPass` pipeline as the
 * production Electron main process to ensure test ↔ production parity.
 */

import path from "node:path";
import fs from "node:fs/promises";
import type { PhotoAnalysisOutput } from "../src/shared/ipc";
import {
  analyzePhotoWithOptionalTwoPass,
  getPrimaryRotateAngle,
  type AnalysisResultWithDecision,
  type RotationDecisionInfo,
} from "../electron/photo-analysis-pipeline";
import { setDatabaseProvider } from "../electron/face-rotation-check";
import { detectFacesInPhoto } from "../electron/face-detection";
import os from "node:os";

/**
 * Try to load better-sqlite3 based DB modules. These are compiled for
 * Electron's Node.js and may not load in system Node. When unavailable,
 * Tier 1 (DB face landmark lookup) is skipped and logged.
 */
let dbAvailable = false;
let _initDesktopDatabase: ((dir: string) => void) | null = null;
let _upsertFaceDetectionResult: ((photoPath: string, result: Record<string, unknown>) => string | null) | null = null;

async function tryLoadDbModules(): Promise<void> {
  try {
    const clientMod = await import("../electron/db/client");
    const analysisMod = await import("../electron/db/media-analysis");
    _initDesktopDatabase = clientMod.initDesktopDatabase;
    _upsertFaceDetectionResult = analysisMod.upsertFaceDetectionResult as typeof _upsertFaceDetectionResult;
    dbAvailable = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message.substring(0, 120) : String(err);
    console.warn(`[test] DB modules unavailable — Tier 1 face lookup disabled: ${msg}`);
  }
}

interface RotationCase {
  file: string;
  expected: {
    quarter_turn_cw: 0 | 90 | 180 | 270;
    straighten_only: boolean;
    crop_required: boolean;
  };
  notes?: string;
}

interface ExpectationsFile {
  version: number;
  notes?: string;
  cases: RotationCase[];
}

interface RunResult {
  file: string;
  expectedAngle: 0 | 90 | 180 | 270;
  actualAngle: 0 | 90 | 180 | 270;
  rotationPass: boolean;
  cropRequired: boolean;
  cropDetected: boolean;
  cropPass: boolean;
  straightenOnly: boolean;
  suggestedRotate: boolean;
  decision: RotationDecisionInfo;
  error: string | null;
}

function parseArgs(): {
  folder: string;
  expectationsPath: string;
  model: string;
  timeoutSec: number;
  think: boolean;
  runFaceDetectionFirst: boolean;
} {
  const args = process.argv.slice(2);
  const map = new Map<string, string>();
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      map.set(key, "true");
      continue;
    }
    map.set(key, next);
    i += 1;
  }

  const folder = map.get("folder") ?? path.resolve("test-assets-local/rotation-crop");
  const expectationsPath =
    map.get("expectations") ??
    path.join(folder, "expectations.json");
  const model = map.get("model") ?? "qwen3.5:9b";
  const timeoutSecRaw = Number.parseInt(map.get("timeoutSec") ?? "180", 10);
  const timeoutSec = Number.isFinite(timeoutSecRaw) && timeoutSecRaw > 0 ? timeoutSecRaw : 180;
  const think = (map.get("think") ?? "false") === "true";
  const runFaceDetectionFirst = (map.get("skipFaceDetection") ?? "false") !== "true";
  return { folder, expectationsPath, model, timeoutSec, think, runFaceDetectionFirst };
}

async function readExpectations(expectationsPath: string): Promise<ExpectationsFile> {
  const raw = await fs.readFile(expectationsPath, "utf-8");
  const parsed = JSON.parse(raw) as ExpectationsFile;
  if (!Array.isArray(parsed.cases)) {
    throw new Error(`Invalid expectations file: ${expectationsPath}`);
  }
  return parsed;
}

function hasCropSuggestion(output: PhotoAnalysisOutput): boolean {
  if (!Array.isArray(output.edit_suggestions)) {
    return false;
  }
  return output.edit_suggestions.some(
    (item) =>
      item.edit_type === "crop" &&
      !!item.crop_rel &&
      typeof item.crop_rel.width === "number" &&
      item.crop_rel.width > 0 &&
      typeof item.crop_rel.height === "number" &&
      item.crop_rel.height > 0,
  );
}

function hasQuarterTurnRotate(output: PhotoAnalysisOutput): boolean {
  return getPrimaryRotateAngle(output) !== null;
}

function formatDecision(d: RotationDecisionInfo): string {
  const parts = [`tier=${d.tier}`];
  if (d.faceDetectedInDb) {
    parts.push(`faceInDb(${d.faceDbCount}): orientation=${d.faceOrientationOnOriginal} angle=${d.faceAngleFromDb}`);
  } else {
    parts.push("faceInDb=none");
  }
  if (d.vlmFirstPassAngle !== null) {
    parts.push(`vlm1st=${d.vlmFirstPassAngle}`);
  }
  if (d.vlmSecondPassResidualAngle !== null) {
    parts.push(`vlm2nd=${d.vlmSecondPassResidualAngle}`);
  }
  if (d.faceOrientationOnRotated) {
    parts.push(`faceOnRotated=${d.faceOrientationOnRotated}`);
  }
  if (d.faceSource) {
    parts.push(`source=${d.faceSource}`);
  }
  parts.push(`final=${d.finalAngle ?? 0}`);
  if (d.fallbackReason) {
    parts.push(`fallback=${d.fallbackReason}`);
  }
  return parts.join(" | ");
}

async function run(): Promise<void> {
  const { folder, expectationsPath, model, timeoutSec, think, runFaceDetectionFirst } = parseArgs();
  const expectations = await readExpectations(expectationsPath);
  const timeoutMs = timeoutSec * 1000;

  await tryLoadDbModules();

  // Initialize a temporary test database so Tier 1 (DB query) works the same as production.
  let testDbDir: string | null = null;
  if (dbAvailable && _initDesktopDatabase) {
    testDbDir = path.join(os.tmpdir(), `emk-test-rotation-${Date.now()}`);
    await fs.mkdir(testDbDir, { recursive: true });
    try {
      _initDesktopDatabase(testDbDir);
      // Wire up face-rotation-check to use the test DB.
      const clientMod = await import("../electron/db/client");
      setDatabaseProvider(() => clientMod.getDesktopDatabase());
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message.substring(0, 120) : String(dbErr);
      console.warn(`[test] DB init failed (native module incompatible?): ${msg}`);
      dbAvailable = false;
      testDbDir = null;
    }
  }

  console.log(`\nAI rotation regression test`);
  console.log(`- Folder: ${folder}`);
  console.log(`- Expectations: ${expectationsPath}`);
  console.log(`- Model: ${model}`);
  console.log(`- Timeout per image: ${timeoutSec}s`);
  console.log(`- Cases: ${expectations.cases.length}`);
  console.log(`- Test DB: ${testDbDir ?? "UNAVAILABLE (Tier1 DB lookup disabled)"}`);
  console.log(`- Run face detection first: ${runFaceDetectionFirst}\n`);

  // Phase 1: Run face detection on all test images and store results in test DB.
  // This mirrors the production flow where face detection is run before AI analysis.
  if (runFaceDetectionFirst && dbAvailable && _upsertFaceDetectionResult) {
    console.log("Phase 1: Running face detection on all test images...");
    for (const testCase of expectations.cases) {
      const imagePath = path.join(folder, testCase.file);
      try {
        const result = await detectFacesInPhoto({ imagePath });
        _upsertFaceDetectionResult(imagePath, result as unknown as Record<string, unknown>);
        console.log(`  ${testCase.file}: ${result.faceCount} face(s) detected`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  ${testCase.file}: face detection failed - ${msg}`);
      }
    }
    console.log("");
  } else if (runFaceDetectionFirst && !dbAvailable) {
    console.log("Phase 1: SKIPPED (DB unavailable — native module compiled for Electron)\n");
  }

  // Phase 2: Run AI analysis using the same pipeline as production.
  console.log("Phase 2: Running AI analysis with face-rotation pipeline...\n");
  const results: RunResult[] = [];
  for (const testCase of expectations.cases) {
    const imagePath = path.join(folder, testCase.file);
    let analysisResult: AnalysisResultWithDecision | null = null;
    let caseError: string | null = null;
    const controller = new AbortController();

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        analysisResult = await analyzePhotoWithOptionalTwoPass({
          imagePath,
          model,
          think,
          timeoutMs,
          signal: controller.signal,
          enableTwoPassRotationConsistency: true,
          useFaceFeaturesForRotation: true,
        });
        caseError = null;
        break;
      } catch (error) {
        caseError = error instanceof Error ? error.message : String(error);
        if (attempt < 2) {
          console.warn(`  retrying after transient error: ${caseError}`);
        }
      }
    }

    if (!analysisResult) {
      const emptyDecision: RotationDecisionInfo = {
        tier: "none",
        faceDetectedInDb: false,
        faceDbCount: 0,
        faceOrientationOnOriginal: null,
        faceAngleFromDb: null,
        vlmFirstPassAngle: null,
        vlmSecondPassResidualAngle: null,
        faceOrientationOnRotated: null,
        faceAngleOnRotated: null,
        faceSource: null,
        finalAngle: null,
        fallbackReason: null,
      };
      const failed: RunResult = {
        file: testCase.file,
        expectedAngle: testCase.expected.quarter_turn_cw,
        actualAngle: 0,
        rotationPass: false,
        cropRequired: testCase.expected.crop_required,
        cropDetected: false,
        cropPass: !testCase.expected.crop_required,
        straightenOnly: testCase.expected.straighten_only,
        suggestedRotate: false,
        decision: emptyDecision,
        error: caseError ?? "Unknown analysis error",
      };
      results.push(failed);
      console.log(`[FAIL] ${failed.file}`);
      console.log(`  error: ${failed.error}`);
      continue;
    }

    const output = analysisResult.output;
    const actualAngle = getPrimaryRotateAngle(output) ?? 0;
    const rotationPass = actualAngle === testCase.expected.quarter_turn_cw;
    const cropDetected = hasCropSuggestion(output);
    const cropPass = testCase.expected.crop_required ? cropDetected : true;
    const suggestedRotate = hasQuarterTurnRotate(output);
    const result: RunResult = {
      file: testCase.file,
      expectedAngle: testCase.expected.quarter_turn_cw,
      actualAngle: actualAngle as 0 | 90 | 180 | 270,
      rotationPass,
      cropRequired: testCase.expected.crop_required,
      cropDetected,
      cropPass,
      straightenOnly: testCase.expected.straighten_only,
      suggestedRotate,
      decision: analysisResult.rotationDecision,
      error: null,
    };
    results.push(result);

    const status = rotationPass && cropPass ? "PASS" : "FAIL";
    console.log(`[${status}] ${result.file}`);
    console.log(`  expected=${result.expectedAngle} actual=${result.actualAngle}`);
    console.log(`  ${formatDecision(result.decision)}`);
    if (testCase.expected.crop_required) {
      console.log(`  crop required=${result.cropRequired} detected=${result.cropDetected}`);
    }
    if (testCase.expected.straighten_only) {
      console.log(`  straighten_only expected; quarter-turn rotate suggested=${result.suggestedRotate}`);
    }
  }

  const rotationPassCount = results.filter((item) => item.rotationPass).length;
  const cropPassCount = results.filter((item) => item.cropPass).length;
  const total = results.length;
  const errorCount = results.filter((item) => item.error !== null).length;

  const tierCounts = {
    tier1: results.filter((r) => r.decision.tier === "tier1-face-existing").length,
    tier2: results.filter((r) => r.decision.tier === "tier2-face-verified").length,
    tier3: results.filter((r) => r.decision.tier === "tier3-vlm-two-pass").length,
    vlmOnly: results.filter((r) => r.decision.tier === "vlm-only").length,
  };

  console.log(`\nSummary`);
  console.log(`- Rotation accuracy: ${rotationPassCount}/${total}`);
  console.log(`- Crop checks passed: ${cropPassCount}/${total}`);
  console.log(`- Analysis errors: ${errorCount}/${total}`);
  console.log(`- Decision tiers: face-tier1=${tierCounts.tier1} face-tier2=${tierCounts.tier2} vlm-two-pass=${tierCounts.tier3} vlm-only=${tierCounts.vlmOnly}`);

  if (testDbDir) {
    try {
      await fs.rm(testDbDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup.
    }
  }

  if (rotationPassCount !== total || cropPassCount !== total) {
    process.exitCode = 1;
  }
}

void run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`test-ai-rotation failed: ${message}`);
  process.exitCode = 1;
});
