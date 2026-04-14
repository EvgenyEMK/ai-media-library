# Windows Installer UX (desktop-media)

## Scope

This document describes user-facing installer behavior for the Windows NSIS package of `apps/desktop-media`.

## Installer goals

- Keep installation straightforward for non-technical users.
- Make app install location configurable.
- Allow selecting where app data is stored (database and related local files).

## Current flow

1. User launches `EMK Desktop Media-<version>-Windows-x64.exe`.
2. NSIS wizard asks for installation directory (standard app binaries location).
3. Installer prompts for app data folder (DB/storage root):
   - Prompt text: "Application data folder (database, settings)"
   - This folder is used as Electron `userData`.
   - Installer remembers the latest selected value and proposes it on next install.
4. Installation completes and app can launch normally.

## User-visible behavior after install

- App opens using the selected app data folder.
- SQLite file remains fixed as `desktop-media.db` in that folder.
- AI models are stored in a separate non-backup path under `ai-models`.
- Disposable runtime cache is stored under `cache` (including `session-data`).
- Settings > Application data files shows:
  - Folder
  - Database file (full path)
  - AI models folder
  - Disposable cache folder

## Non-goals (not in current phase)

- In-app changing of DB path
- Multiple DB profiles
- Per-profile model/cache locations

## Future UX extensions

- Add explicit installer copy explaining what will be stored in the data folder.
- Add one-click "open database folder" action in Settings.
- Add "migrate database location" wizard for existing users.
