# Desktop-media Phase 2: App Update Notifications and Install-on-Confirm

Status: Planned after repository split/move to public desktop-focused repo

## Why separated from current implementation

Phase 2 depends on release hosting, channel strategy, and signing setup that
will change after moving desktop-media to a dedicated public repository.

## Planned outcomes

- In-app notification when a new version is available.
- User confirmation step before download/install.
- Download progress and "restart to apply update" flow.
- Release metadata hosted from the new public desktop repository.

## Expected stack

- `electron-updater` + GitHub Releases provider (or equivalent in new repo).
- Signed builds for public distribution.

## Compatibility note

- Windows 11 is not required.
- Windows 10 support is considered a plus and should be preserved when feasible.
