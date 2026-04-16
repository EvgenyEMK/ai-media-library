# ai-media-library

### A private, intelligent home for your photos and (later) videos.
Desktop application that helps you organize and search your media using AI—without ever sending your data to the cloud.
Open source and runs entirely on your computer: local data, local AI models, no vendor lock.

While currently desktop-only, it is built with the possibility to extend to multi-client and cloud: desktop + mobile apps + web (monorepo with shared packages).


## Key Capabilities

- **Find anything with natural language**
  - Search for "lady in white dress near piano" just like you would on Google Photos, but 100% offline
- **Search in any language** - the prompt is automatically translated to English (AI indexing is currently English-only)
  - The search is based on visual similarity (VLM - Visual Language Model) and/or on AI image description

- **Face detection and recognition**
  - The app automatically detects faces and groups them, making it easy to tag family and friends
  - You can narrow the search scope to tagged people, including automatically detected similar faces as an option
  - You can filter images in a folder, album or in search by person tags or by number of people
  - Pet faces are detected, but I haven't tested the grouping / auto-recognition for pets
  - [roadmap] detection of sex and average age per face for smart filters/albums

- **AI image analysis, categorization, invoice data extraction**
  - Assess image quality and photo aesthetic rating, identify key issues like blur, rotation needed, crop needed, tilted horizon, etc.
  - Automatically identify categories like ID / passport, invoice / receipt, screenshot, slide / diagram, nature, etc.
  - Automatically extract data from invoice / receipt images: subject, invoice issuer, total and VAT amount, currency, etc.
  - Automated suggestions to rotate image based on AI analysis and detected face features

- **Geo-location context**
  - GPS coordinates can be translated to **searchable / filterable context** (country / region / city)
  - If there are no GPS coordinates, AI tries to extract location from image analysis and/or the file name

- **Powerful filters** based on the features above: **person tags**, **people counts**, **locations**, ratings, image category.

- **Smart albums** [roadmap]
  - Dynamic albums based on defined filters, for example, "My friend and I - best photos", "School friends", ...

- **Image taken date**
  - For images with missing "date taken" metadata, automatic extraction of the date or period from file name or path
  - For example, "1961-01 - old family photo.jpg", or "visiting Paris - 1985 july.jpg" (useful for old photos)

- **Data safety** 
  - The application **does NOT modify any files** in your media library by default
  - It only collects data into a searchable database (file metadata + AI detections and analytics)
  - Even if you lose the database, you can re-build most data by running AI analysis pipelines again (but would need to tag people manually again)
  - During installation you can select a folder where the database and application settings are stored. The data is preserved if you uninstall or re-install the app. Include the folder in your backup plan.
  - Optionally you can allow saving data like **star rating** to file metadata when it is changed by the user within the app, so it is visible in Windows Explorer, for example. While supported, it is disabled by default.

## License

- Repository default license: `MIT`, i.e. open source and free to use and modify.
- AI models and especially model weights are licensed by their original authors and are not automatically covered by the app code license.
- Some AI models are open source, but limited to non-commercial / research-only usage.
- More details in /apps/desktop-media/LICENSE

## Limitations & Transparency

- The application is in early **beta**.
- AI indexing and analysis currently covers only images (not yet videos).
- Current limitation details and behavior notes are documented in [docs/limitations-and-transparency.md](docs/limitations-and-transparency.md).

## Platform Support

| Platform | Status | Notes |
| :--- | :--- | :--- |
| **Desktop Windows** | Beta | [Download](https://github.com/EMK-Dev/ai-media-library/releases/latest) |
| **Desktop Linux** | Planned | - |
| **Desktop MacOS** | Planned | - |
| **Local web server for TV browsers** | Planned | - |
| **Android / iOS mobile apps** | - | If desktop app gets traction |
| **Cloud platform for data sharing and backup** | - | Private repo currently |

## Prerequisites - desktop app

### Minimum PC configuration (practical baseline)

For small/medium libraries this baseline is recommended:

- **OS:** Windows 10/11, 64-bit
- **CPU:** modern 4+ core CPU (8+ cores recommended for faster indexing)
- **RAM:** 16 GB minimum (32 GB recommended for large libraries and parallel pipelines)
- **GPU:** optional but highly recommended for model throughput, especially during initial AI indexing/analysis phase
  - **Minimum usable:** 4 GB VRAM
  - **Recommended:** 8 GB+ VRAM
- **Disk:** SSD strongly recommended (AI pipelines do heavy read/write and benefit a lot from SSD)

Without a capable GPU, the app still works on CPU but indexing/analysis jobs can be much slower.

### Ollama installation and required models

Ollama is not required for core app features like contextual VLM-based search using English query, face detection and recognition.
But the following features depend on LLM models hosted via Ollama:
- search query translation and parsing for advanced search
- image/document analysis (e.g. building textual image description used as 2nd search method)
- invoice data extraction
- date and location extraction from file name or path.

Install Ollama and download AI models before running the desktop app:

1. **Install Ollama**
   - Download and install from [ollama.com](https://ollama.com/download).
   - Start Ollama and keep it running in the background.

2. **Pull required Qwen models**
```bash
ollama pull qwen3.5:9b
ollama pull qwen2.5vl:3b
```

3. **Verify models are available**
```bash
ollama list
```

4. **(Optional) Verify Ollama API endpoint**
   - Default endpoint used by the app: `http://127.0.0.1:11434`
   - If you run Ollama on a different host/port, set `EMK_OLLAMA_BASE_URL` accordingly when starting the app.

**Model usage in this app**
- `qwen3.5:9b`: default for photo/document analysis workflows
- `qwen2.5vl:3b`: preferred lightweight model for query understanding/translation, with fallback to `qwen3.5:9b`


## Technical overview

### Tech stack and architecture

This is a **pnpm + Turbo monorepo** with shared packages used by the desktop app, web app and possible future mobile apps.

- **Desktop client:** Electron + React (`apps/desktop-media`)
- **Core language/runtime:** TypeScript + Node.js
- **Persistence:** local SQLite (`better-sqlite3`) with optional `sqlite-vec` backend for vector operations
- **Shared packages:** common metadata, state/store, viewer, API contracts, and SDK under `packages/*`

`apps/web-media` in this repository is currently a placeholder. The active web app is maintained separately for now. It allows multi-tenant data hosting (multiple users with their own data libraries) and usage of commercial cloud AI model APIs on top of local AI models.

### AI pipeline (local engine)

All major AI workflows run locally on your machine:

- **Vision/text embeddings for semantic search:** `nomic-embed-vision-v1.5` + `nomic-embed-text-v1.5` (ONNX pipeline)
- **Face detection and face embeddings:** RetinaFace (`retinaface_mv2.onnx`) + ArcFace (`w600k_r50.onnx`)
- **LLM tasks through Ollama local API (`/api/chat`):**
  - Query understanding / translation: prefers `qwen2.5vl:3b` with fallback to `qwen3.5:9b`
  - Photo/document analysis defaults to `qwen3.5:9b`

### Data schema and persistence

- **Primary local DB:** `desktop-media.db` in the app `userData` path (configurable during install)
- **Local settings file:** `media-settings.json` in the same user data folder
- **No default file mutation:** original media files are not modified unless you explicitly enable write-back for selected fields (e.g., star rating)
- **No vendor lock-in:** all indexing/analysis data is stored locally and can be rebuilt by rerunning pipelines

### Developer setup

For contributors who want to run or extend the code:

**Prerequisites**
- Node.js (modern LTS recommended)
- pnpm (workspace package manager)
- Ollama (for LLM-powered features, with Qwen models pulled locally)
- Optional: Python (some helper/debug scripts)

**Install and run**
```bash
pnpm install
pnpm dev
```

(`pnpm dev` runs the desktop app; same as `pnpm dev:desktop`.)

**Build distributable app packages**

Current repository support is focused on Windows packaging:

- **Windows (.exe installer):**
```bash
pnpm --filter @emk/desktop-media dist:win
```

This runs the desktop production build and Electron Builder, then produces Windows installer artifacts (including `.exe`) in the desktop app output folders.

Linux and macOS package targets are planned but are not yet configured in this repository.

**Tests**
- Unit / integration (Vitest): `pnpm test`
- Desktop E2E (Playwright; builds app first): `pnpm test:e2e`
- Full test run: `pnpm test:all`

Desktop E2E fixtures are now tracked in-repo under `apps/desktop-media/test-assets-local/`.
See [docs/desktop-e2e-local-assets.md](docs/desktop-e2e-local-assets.md) for fixture notes and troubleshooting.
