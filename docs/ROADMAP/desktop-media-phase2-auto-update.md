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

## GitHub Releases: multi-OS assets for `electron-updater`

Packaged builds use `electron-updater` with `publish.provider: github` in `apps/desktop-media/electron-builder.yml`. **Linux users only receive in-app updates if the same GitHub Release (or tag) includes Linux update metadata and binaries alongside Windows.**

When cutting a release, ensure the release assets include at least:

| OS | Update metadata | Install / update payloads |
|----|-----------------|---------------------------|
| Windows | `latest.yml` | NSIS `.exe` (and `.exe.blockmap` when produced by electron-builder publish) |
| Linux | `latest-linux.yml` | `.AppImage` (primary for auto-update), and `.deb` / blockmaps if you ship them |

**Practical options:**

1. **Single machine or CI matrix**: run `electron-builder` once with both `--win --linux` (after building on each OS or using split jobs that merge assets into one release), or publish from CI after all platform artifacts are built.
2. **Split CI jobs**: one job produces Windows artifacts + `latest.yml`, another produces Linux artifacts + `latest-linux.yml`; the release step must upload **all** files to **one** GitHub Release so clients on each OS see the correct YAML.

If `latest-linux.yml` is missing, Linux installs still run, but startup / manual “check for updates” will not find new versions via the updater feed.
