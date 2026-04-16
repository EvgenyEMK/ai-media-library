# Desktop E2E test assets

Desktop Playwright tests use fixture assets under:

`apps/desktop-media/test-assets-local/e2e-photos/`

Related fixture folders:

- `apps/desktop-media/test-assets-local/e2e-media-mixed/`
- `apps/desktop-media/test-assets-local/rotation-crop/`

These fixtures are now tracked in the repository so CI can run E2E suites consistently.

## Optional override

Set `EMK_E2E_PHOTOS_DIR` to an absolute path if you want to run tests against a different local asset folder.

## Replacing fixtures

When replacing fixtures, keep each test contract in sync:

1. Update required filenames in relevant E2E specs (`REQUIRED_FILES`, `REQUIRED_FILTER_FILES`, etc.).
2. Update filename-based mappings in `tests/e2e/fixtures/mock-ollama.ts` when quick-filter expectations depend on category mapping.
3. Keep `apps/desktop-media/test-assets-local/e2e-photos/expectations.json` aligned for unconfirmed-face and semantic expectations.
4. Re-run `pnpm test:e2e` (or CI smoke subset) to confirm no regressions.

## Troubleshooting (semantic / vision indexing)

If E2E or local runs fail with Transformers.js / ONNX errors such as **“Protobuf parsing failed”** when loading a `model.onnx` under `nomic-ai`, the Hugging Face model cache under `@huggingface/transformers` may be corrupted. Delete the **`nomic-ai`** (or the specific model) folder inside that package’s **`.cache`** directory under `node_modules`, then re-run the test so models download again.
