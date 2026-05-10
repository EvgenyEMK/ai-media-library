# Local AI model weights (`ai-models/`)

Layout mirrors the packaged app under `%AppData%/Roaming/EMK Desktop Media/ai-models/`:

- **`onnx/`** — native face / aux ONNX weights (same files `pnpm download-ai-models` fetches).
- **`huggingface/`** — Transformers.js Hugging Face cache + hub model trees (`cache/` and `models/` inside).

This directory holds **optional local copies** of ONNX and related files used by **desktop-media** (face pipeline, aux models, and Nomic embedding assets). Large binaries are **gitignored**; this `README.md` and `MODELS.json` are **tracked** so the inventory stays in version control.

## Refresh face / aux ONNX files

From the repository root:

```bash
pnpm download-ai-models
```

## Nomic vision & text (Transformers.js)

The app loads **`nomic-ai/nomic-embed-vision-v1.5`** and **`nomic-ai/nomic-embed-text-v1.5`** with **quantized ONNX** (`pipeline(..., { quantized: true })`). Under **`huggingface/models/`**, Hub repos mirror the **minimum** files needed:

- `huggingface/models/nomic-ai/nomic-embed-vision-v1.5/` — `config.json`, `preprocessor_config.json`, `onnx/model_quantized.onnx`
- `huggingface/models/nomic-ai/nomic-embed-text-v1.5/` — tokenizer + sentence-transformers configs + `onnx/model_quantized.onnx`

**Source hubs (canonical):**

- Vision: [nomic-ai/nomic-embed-vision-v1.5](https://huggingface.co/nomic-ai/nomic-embed-vision-v1.5)
- Text: [nomic-ai/nomic-embed-text-v1.5](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)

**Runtime:** The Electron app sets Transformers `env.cacheDir` / `env.localModelPath` under `ai-models/huggingface/` (see `nomic-vision-embedder.ts`). Copying hub layouts into `huggingface/models/` is useful for **offline / backup** archives alongside `onnx/`.

## Machine-readable inventory

See **`MODELS.json`** for each artifact’s **purpose** and **download / upstream links**.

## Licenses

Each weight file follows its **upstream** license (Apache-2.0, MIT, Nomic terms, etc.). The application repo is MIT; **compliance for model use is your responsibility** (see root `LICENSE` model notice).
