# Desktop E2E: local photo assets (not in git)

Some Playwright tests use **real image files** for semantic search and face workflows. Those files live **only on your machine** under:

`apps/desktop-media/test-assets-local/e2e-photos/`

This directory is **gitignored** because it may contain **personal or sensitive content** (IDs, invoices, addresses, etc.). Do **not** commit it.

## Optional override

Set `EMK_E2E_PHOTOS_DIR` to an absolute path if your assets live elsewhere.

## Replacing fixtures

When you have a **sanitized, non-sensitive** image set that still satisfies each spec’s required filenames, you can:

1. Document the required filenames in the relevant `tests/e2e/*.spec.ts` files (see `REQUIRED_FILES` and similar).
2. Swap your local folder contents or point `EMK_E2E_PHOTOS_DIR` at a dedicated fixtures repo/path.

Until then, tests that depend on these files will **skip** or **fail** if the folder or files are missing.

## Troubleshooting (semantic / vision indexing)

If E2E or local runs fail with Transformers.js / ONNX errors such as **“Protobuf parsing failed”** when loading a `model.onnx` under `nomic-ai`, the Hugging Face model cache under `@huggingface/transformers` may be corrupted. Delete the **`nomic-ai`** (or the specific model) folder inside that package’s **`.cache`** directory under `node_modules`, then re-run the test so models download again.
