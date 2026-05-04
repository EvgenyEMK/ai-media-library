# Albums module (desktop)

Product documentation for **manual albums** and **smart albums** in the desktop app (`apps/desktop-media`). This folder is the home for albums UX and business rules; it complements technical types in `@emk/shared-contracts` and the SQLite implementation under `electron/db/media-albums.ts`.

| Document | Contents |
| --- | --- |
| [desktop-albums-ux.md](./desktop-albums-ux.md) | Navigation, screens, empty states, drag-and-drop, smart album roots and filter panel behavior |
| [desktop-albums-business-logic.md](./desktop-albums-business-logic.md) | Data model, query semantics, ordering, and filter rules |

Older generic “web-style” album bullets in [media-library-overview.md](../media-library/media-library-overview.md) do not describe the current Electron product; prefer this folder for desktop albums.
