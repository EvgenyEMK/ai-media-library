# Local AI model weights (`ai-models/`)

This directory holds **optional local copies** of ONNX and related files used by **desktop-media** (face pipeline, aux models, and Nomic embedding assets). Large binaries are **gitignored**; this `README.md` and `MODELS.json` are **tracked** so the inventory stays in version control.

## Refresh face / aux ONNX files

From the repository root:

```bash
pnpm download-ai-models
```

## Nomic vision & text (Transformers.js)

The app loads **`nomic-ai/nomic-embed-vision-v1.5`** and **`nomic-ai/nomic-embed-text-v1.5`** with **quantized ONNX** (`pipeline(..., { quantized: true })`). Subfolders here mirror the **minimum** files needed for that layout:

- `nomic-embed-vision-v1.5/` — `config.json`, `preprocessor_config.json`, `onnx/model_quantized.onnx`
- `nomic-embed-text-v1.5/` — tokenizer + sentence-transformers configs + `onnx/model_quantized.onnx`

**Source hubs (canonical):**

- Vision: [nomic-ai/nomic-embed-vision-v1.5](https://huggingface.co/nomic-ai/nomic-embed-vision-v1.5)
- Text: [nomic-ai/nomic-embed-text-v1.5](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)

**Runtime:** `@huggingface/transformers` normally caches models under the Hugging Face cache directory. Copying into this folder is for **your backup / offline archive**; wiring the app to read only from here would require setting Transformers `env.localModelPath` / local paths (not the default today).

## Machine-readable inventory

See **`MODELS.json`** for each artifact’s **purpose** and **download / upstream links**.

## Licenses

Each weight file follows its **upstream** license (Apache-2.0, MIT, Nomic terms, etc.). The application repo is MIT; **compliance for model use is your responsibility** (see root `LICENSE` model notice).
