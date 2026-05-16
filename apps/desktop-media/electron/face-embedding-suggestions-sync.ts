import { app } from "electron";
import { refreshAllSuggestions } from "./db/person-suggestions";
import { readSettings } from "./storage";

/** Rebuild unconfirmed person suggestions after new face embeddings are stored. */
export async function refreshPersonSuggestionsAfterEmbeddings(): Promise<number> {
  const settings = await readSettings(app.getPath("userData"));
  return refreshAllSuggestions({
    threshold: settings.faceDetection.faceRecognitionSimilarityThreshold,
  });
}
