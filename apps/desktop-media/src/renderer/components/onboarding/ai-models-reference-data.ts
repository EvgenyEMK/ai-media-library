/** Curated rows for onboarding / Settings — expand as models ship. */
export interface AiModelReferenceRow {
  purpose: string;
  nameOrFamily: string;
  licenseUrl: string;
}

/** Bundled / sidecar models first; Ollama-hosted rows last. */
export const AI_MODEL_REFERENCE_ROWS: readonly AiModelReferenceRow[] = [
  {
    purpose: "Face detection",
    nameOrFamily: "YOLO variants or RetinaFace",
    licenseUrl: "https://github.com/ultralytics/ultralytics/blob/main/LICENSE",
  },
  {
    purpose: "Face landmarks",
    nameOrFamily: "ONNX landmark model (e.g. PFLD-style)",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
  },
  {
    purpose: "Image rotation detection",
    nameOrFamily: "ONNX orientation classifier",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
  },
  {
    purpose: "Age and gender detection",
    nameOrFamily: "ONNX age/gender estimator",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
  },
  {
    purpose: "Semantic / vision embeddings",
    nameOrFamily: "Nomic embed family",
    licenseUrl: "https://www.nomic.ai/gpt4all",
  },
  {
    purpose: "AI image analysis (via Ollama)",
    nameOrFamily: "User-selected (e.g. Qwen3.5 vision)",
    licenseUrl: "https://github.com/QwenLM/Qwen/blob/main/LICENSE",
  },
  {
    purpose: "Search prompt translation (via Ollama)",
    nameOrFamily: "User-selected (e.g. Qwen2.5)",
    licenseUrl: "https://github.com/QwenLM/Qwen/blob/main/LICENSE",
  },
];
