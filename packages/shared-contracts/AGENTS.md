# AGENTS.md — @emk/shared-contracts

## Overview

Shared TypeScript types, domain models, and adapter interfaces consumed by all apps and packages.
This package contains **zero runtime dependencies** — only type definitions and pure utility functions.

---

## Architecture

```
src/
  index.ts                          # Public exports
  ai/
    provider.ts                     # AiProviderAdapter, AiProviderRequest, AiProviderResult
  domain/
    media.ts                        # MediaRecord, MediaIdentity, MediaSource, AiAnnotation
  embedding/
    provider.ts                     # EmbeddingProviderAdapter, EmbeddingRequest, EmbeddingResult
  face-detection/
    index.ts                        # Re-exports
    bounding-box.ts                 # CanonicalBoundingBox, bounding box utilities
    provider.ts                     # FaceDetectionProviderAdapter, request/response types
    rotation-heuristics.ts          # Face landmark orientation estimation
  repository/
    media.ts                        # MediaRepository, MediaItemRecord (data access contract)
  sync/
    operations.ts                   # SyncOperation, SyncBatch, SyncConflict
  utils/
    index.ts                        # Re-exports all utilities
    math.ts                         # clamp()
    arrays.ts                       # chunkArray()
    text-formatters.ts              # toHeadlineLabel(), getCategoryLabel(), getGenderLabel()
  vector-store/
    adapter.ts                      # VectorStoreAdapter, search/upsert param types
```

---

## Key Rules

1. **Types and pure functions only.** No runtime dependencies, no side effects, no I/O. Every export must be either a TypeScript type/interface or a pure function.

2. **Adapter interfaces are contracts.** Each adapter interface defines a provider-agnostic contract. Implementations live in the consuming apps or `lib/`.

   | Interface | Module | Implementations |
   |-----------|--------|-----------------|
   | `AiProviderAdapter` | `ai/provider` | Desktop: Ollama; Web: OpenAI / Azure |
   | `EmbeddingProviderAdapter` | `embedding/provider` | Desktop: `OllamaEmbeddingAdapter`; Web: cloud APIs |
   | `FaceDetectionProviderAdapter` | `face-detection/provider` | Desktop: RetinaFace sidecar; Web: Azure Face, Google Vision |
   | `VectorStoreAdapter` | `vector-store/adapter` | Desktop: `SQLiteVectorStoreAdapter`; Web: pgvector |
   | `MediaRepository` | `repository/media` | Desktop: SQLite db modules; Web: Supabase queries |

3. **Versioning policy.** Breaking changes to interfaces must be communicated. When an interface changes, all implementations must be updated in the same PR.

4. **Domain types are canonical.** `MediaRecord`, `MediaIdentity`, etc. are the shared vocabulary. Desktop SQLite rows and Supabase rows both map to these types.

5. **Face detection types.** `CanonicalBoundingBox` is the normalized format. Provider-specific formats are converted via `buildCanonicalBoundingBox()`.

6. **Future: Action intent types.** Typed action intent definitions (for AI intent translation / automation) will live here so both web and desktop apps share the same action vocabulary.

---

7. **Shared utilities.** General-purpose pure functions (`clamp`, `chunkArray`, `toHeadlineLabel`, etc.) live in `utils/`. When you find a utility duplicated across 2+ packages/apps, extract it here.

8. **Adding a new provider.** To support a new backend (e.g., a new AI model, a new face detection API):
   - Confirm the relevant adapter interface in this package meets the new provider's needs.
   - Create an adapter class in the consuming app/package that implements the interface.
   - Register the adapter in the app's provider configuration (registry or DI).
   - If the interface needs changes, update the contract here **and** all existing implementations.

---

## Testing

- Unit test all pure utility functions (bounding box math, rotation heuristics, shared utils).
- Type tests (compile-only) to verify interface compatibility.
