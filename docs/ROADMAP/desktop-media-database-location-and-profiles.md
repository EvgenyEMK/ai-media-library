# Desktop-media: Database Location and Profiles

Status: Roadmap (partially implemented)

## Scope

This roadmap tracks data-location UX for the desktop-media Electron app.

## Phase 3A (implemented now)

- During Windows installer flow, user can pick a folder for app user data.
- App persists this selection and uses it as Electron `userData` root.
- SQLite DB remains `desktop-media.db` inside that selected folder.
- Settings page shows database location in a read-only section for visibility.

## Future extension: in-app DB selection and profiles

Potential feature (not implemented yet):

- Allow selecting a different database file/folder from app settings.
- Introduce named DB profiles (for example: Family, Work, Archive).
- Support switching active profile in one app installation.
- Require safe restart or controlled DB handle reopen when switching.

## Open design questions

- Should profile switch require full app restart in v1?
- Should models/cache paths stay global or be profile-specific?
- Should import/export/backup be profile-aware from day one?
