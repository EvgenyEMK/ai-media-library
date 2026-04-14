# Windows Installer Business Logic (desktop-media)

## Scope

This document captures technical/product logic behind installer-selected database folder behavior.

## Data path ownership model

- App executable location and app data location are independent.
- Installer-selected data folder is persisted in:
  - `%APPDATA%\EMK Desktop Media\install-config.ini` (`[Paths] UserDataPath=...`)
- Legacy fallback (for backward compatibility):
  - `%APPDATA%\EMK Desktop Media\install-user-data-path.txt`
- At startup, app resolves `userData` path in priority order:
  1. `EMK_DESKTOP_USER_DATA_PATH` env var (test/dev override)
  2. persisted installer-selected path
  3. Electron default `app.getPath("userData")`

## DB and local artifacts

- Database path is deterministic:
  - `<userData>/desktop-media.db`
- Backup-critical files remain in `<userData>` (database and settings).
- Runtime/disposable artifacts are decoupled from `<userData>` and stored under `%APPDATA%\EMK Desktop Media\`:
  - `ai-models/` (downloaded AI models)
  - `cache/` (disposable runtime cache, including `session-data/`)

## Settings visibility contract

- Renderer can query database location through IPC (`getDatabaseLocation`).
- The settings UI exposes values as read-only:
  - `userDataPath`
  - `dbPath`
  - `modelsPath`
  - `cachePath`

## Safety / compatibility notes

- Existing installs without installer config file continue to work with default `userData`.
- `EMK_DESKTOP_USER_DATA_PATH` keeps test automation deterministic.
- No in-place DB migration is executed in this phase.

## Planned next steps

- In-app database relocation flow with safe copy/verify/restart.
- Optional profile abstraction for switching between multiple databases.
