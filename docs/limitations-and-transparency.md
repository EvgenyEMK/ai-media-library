# Limitations & Transparency

This page contains the longer limitation notes moved from the repository `README.md`.

## Images only, no video AI analysis/search yet

- AI indexing and analysis of video is possible, but not yet implemented.

## Early beta state

- The app has been tested on a large personal media library (30K images, >100K detected faces), and core workflows are stable.
- Bug fixes and minor data model updates are still expected (with automatic migrations in newer versions).

## AI search limitations

- Contextual search quality is strong for local models, but it is not perfect; some prompts require iteration.
- Combining search with filters (person tags, date, location) usually improves precision.
- Example: a query like "woman wearing red hat and white dress in Paris" may match red/white visual patterns without always matching both "hat" and "dress" exactly.

## AI pipelines can take hours/days on large libraries

- To unlock all features, run multiple pipelines:
  - Metadata collection (EXIF size/date/title/GPS, etc.)
  - Semantic search indexing
  - Face detection + manual tagging + similar-face expansion
  - AI image/document analysis and optional invoice extraction
- On large libraries, each pipeline can take hours or days. Plan for long-running jobs.
- Start with a few folders first (especially people-heavy folders) so you can validate flow and tag faces early.

## No in-app update announcement yet

- Automatic update announcement inside the app is not implemented yet.
- For now, check the GitHub repository/releases manually.

## AI model limitations

- Most vision/embedding models are downloaded automatically after installation.
- Heavy LLM tasks (query translation/parsing, analysis extraction workflows) rely on Ollama and locally pulled models.
- Model selection is currently fixed in code for most pipelines; future configurability will focus primarily on generic LLM tasks.

## Favorites and star ratings portability

- Many mobile gallery apps do not store favorites/star ratings in file metadata.
- They keep this information in app-specific databases, so favorite status is often lost when copying files to a PC.
- This is not specific to this app, but it affects migration expectations.
- If preserving favorites/stars matters, use tools/apps that write this data into standard file metadata.
