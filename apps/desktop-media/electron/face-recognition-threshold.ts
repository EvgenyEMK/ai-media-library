import { app } from "electron";
import { readSettings } from "./storage";

/** Persists under Settings → Face recognition → similarity threshold. */
export async function getFaceRecognitionSimilarityThreshold(): Promise<number> {
  const settings = await readSettings(app.getPath("userData"));
  return settings.faceDetection.faceRecognitionSimilarityThreshold;
}
