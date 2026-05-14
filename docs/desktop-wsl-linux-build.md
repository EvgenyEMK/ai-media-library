# Build and manually test the Linux desktop distributable on WSL2 (Ubuntu)

Use **WSL2** with **Ubuntu** on Windows 11. Build the repo on the **Linux filesystem** (`~/…`), not only under `/mnt/c/…`, so `pnpm` and native compiles stay fast and reliable.

## 1. Install and verify WSL2

In **PowerShell** (as a normal user; elevated only if `wsl --install` asks for it):

```powershell
wsl --install
wsl --status
wsl -l -v
```

Ensure your distro shows **VERSION 2**. If an older distro is VERSION 1:

```powershell
wsl --set-version Ubuntu 2
```

Reboot once if Windows asked you to after the first install.

## 2. Ubuntu packages (compiler, deb tooling, optional FUSE)

Open **Ubuntu** (Start menu → Ubuntu, or `wsl` in PowerShell), then:

```bash
sudo apt update
sudo apt install -y build-essential python3 git curl fakeroot ca-certificates
```

**AppImage** may need FUSE on some Ubuntu releases. If running the `.AppImage` later fails with a FUSE/squashfs error, install the fuse package your distro documents (e.g. `libfuse2` / `fuse3` / `squashfuse`) and try again—or skip AppImage for WSL smoke tests and use the **deb** or the **unpacked** binary (see below).

## 3. Node.js 24 and pnpm (match CI)

Using **nvm** (recommended):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Close and reopen the Ubuntu shell, then:
nvm install 24
nvm use 24
```

Enable **pnpm** via Corepack (same major as CI: `10.16.1`):

```bash
corepack enable
corepack prepare pnpm@10.16.1 --activate
pnpm -v
```

## 4. Clone the repo under `~` (not only `/mnt/c`)

```bash
mkdir -p ~/dev
cd ~/dev
git clone https://github.com/EMK-solutions/ai-media-library.git
cd ai-media-library
```

If you already use a clone on `C:` under `/mnt/c/...`, you can still **build** there in a pinch, but expect slower installs and occasional permission/symlink issues; prefer `~/dev/ai-media-library` for routine Linux builds.

## 4b. Unpushed branch: use your Windows working copy (no GitHub)

Your feature branch only has to exist on disk; **GitHub is not required**.

### Option A — Clone from the Windows path into `~` (recommended)

In WSL, `C:\EMK-Dev\ai-media-library` is visible as **`/mnt/c/EMK-Dev/ai-media-library`** (adjust drive and path to match your PC).

```bash
mkdir -p ~/dev
git clone /mnt/c/EMK-Dev/ai-media-library ~/dev/ai-media-library
cd ~/dev/ai-media-library
git checkout <your-feature-branch>   # if not already the checked-out branch
```

`git clone` copies the repo including **local branches and commits** that were never pushed. Ignored paths (e.g. `node_modules`) are not copied, which is what you want: run **`pnpm install`** in WSL so native modules compile for Linux.

### Option B — Build in place under `/mnt/c`

```bash
cd /mnt/c/EMK-Dev/ai-media-library
git checkout <your-feature-branch>
```

If you previously ran **`pnpm install` from Windows (PowerShell)** on this tree, delete Linux-incompatible native builds before installing in WSL:

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install --frozen-lockfile
```

Then run **`pnpm --filter @emk/desktop-media run dist:linux`** as in step 5. This is the same code as on Windows, but I/O on `/mnt/c` is slower than a clone under `~/`.

### Option B2 — `git fetch` from the Windows repo into an existing `~/` clone

If you already have `~/dev/ai-media-library` and only want to pull your Windows branch across:

```bash
cd ~/dev/ai-media-library
git remote add windrive /mnt/c/EMK-Dev/ai-media-library   # once
git fetch windrive <your-feature-branch>
git checkout -B <your-feature-branch> FETCH_HEAD
```

Resolve any “unrelated histories” prompts only if you mixed two different roots; normally this is a fast-forward or a simple merge.

## 5. Install dependencies and produce Linux artifacts

From the **monorepo root**:

```bash
pnpm install --frozen-lockfile
pnpm --filter @emk/desktop-media run dist:linux
```

Artifacts appear under:

`apps/desktop-media/release/artifacts/`

including roughly:

- `AI Media Library-<version>-Linux-x86_64.AppImage`
- `AI Media Library-<version>-Linux-amd64.deb` (or similar arch suffix from electron-builder)
- `latest-linux.yml` (used when publishing to GitHub for auto-update)

First `dist:linux` can take several minutes (`better-sqlite3` compile, etc.).

From the monorepo root you can also run **`pnpm dist:linux`** (same as `pnpm --filter @emk/desktop-media run dist:linux`).

### Troubleshooting: `None of the selected packages has a "dist:linux" script`

That means **`apps/desktop-media/package.json` in your current tree does not define `dist:linux`** (your WSL clone is behind the branch that added Linux packaging, or those edits exist only as **uncommitted** files on Windows).

1. On **Windows**, commit the packaging changes (anything you want in WSL must be in Git objects):  
   `git status` → `git add` / `git commit`.
2. In **WSL**, update the repo from the Windows clone (see **§4b**), for example:

   ```bash
   cd ~/dev/ai-media-library
   git remote add windrive /mnt/c/EMK-Dev/ai-media-library   # skip if already added
   WIN_BRANCH=$(git -C /mnt/c/EMK-Dev/ai-media-library branch --show-current)
   git fetch windrive "$WIN_BRANCH"
   git merge FETCH_HEAD
   ```

3. Confirm the script exists: `grep dist:linux apps/desktop-media/package.json`

Alternatively remove `~/dev/ai-media-library` and **`git clone` again** from `/mnt/c/...` after committing on Windows.

### Troubleshooting: `Cannot find module '@rollup/rollup-linux-x64-gnu'` (Rollup / Vite)

You ran **`pnpm … dist:linux` or `pnpm build` from WSL** while the repo lives under **`/mnt/c/...`** and `node_modules` was produced by **Windows** `pnpm install`. Optional native Rollup bindings are OS-specific.

**Fix:** Run Linux builds only from a clone under **`~/…`** where **`pnpm install --frozen-lockfile` was executed inside WSL** (see **§4b**). Do not reuse the same `node_modules` tree for Windows and WSL.

### Troubleshooting: `configuration has an unknown property 'homepage'` (electron-builder 26)

Put **`homepage` in `apps/desktop-media/package.json`** (required for `.deb` / FPM). Do **not** set a root-level `homepage` key in `electron-builder.yml` — electron-builder **26.x** rejects it (use `extraMetadata` only if you need to inject metadata without editing `package.json`).

**Faster compile-only smoke** (unpack directory, no AppImage/deb):

```bash
pnpm --filter @emk/desktop-media run dist:linux:dir
```

The unpacked app is under `apps/desktop-media/release/artifacts/linux-unpacked/`.

## 6. Manual install / run tests (GUI via WSLg)

Windows 11 **WSLg** usually provides a display so Electron windows appear on the Windows desktop. If the app window does not open, update WSL (`wsl --update` in PowerShell) and confirm you are on WSL2.

### Option A — AppImage

```bash
cd ~/dev/ai-media-library/apps/desktop-media/release/artifacts
chmod +x ./AI\ Media\ Library-*-Linux-x86_64.AppImage
./AI\ Media\ Library-*-Linux-x86_64.AppImage
```

(Adjust the filename glob to match the file on disk, `ls` if needed.)

### Option B — deb package

```bash
cd ~/dev/ai-media-library/apps/desktop-media/release/artifacts
sudo apt install -y ./*.deb
# If dpkg complains about dependencies:
sudo apt -f install -y
```

Then launch **AI Media Library** from the Ubuntu/WSL applications menu, or run the installed binary name shown after install (`dpkg -L` on the package if unsure).

### Option C — unpacked tree (no installer)

```bash
cd ~/dev/ai-media-library/apps/desktop-media/release/artifacts/linux-unpacked
./"AI Media Library"
```

(Exact executable name matches `productName`; use `ls` in that folder if the quoting differs.)

## 7. Optional checks

- **Disk / RAM**: native builds are heavy; if the linker is killed (`Killed`), close other apps or add WSL swap in `.wslconfig` on Windows.
- **Help → Check for updates** in the packaged app only works when a GitHub Release includes **`latest-linux.yml`** and the matching Linux files; see [docs/ROADMAP/desktop-media-phase2-auto-update.md](ROADMAP/desktop-media-phase2-auto-update.md).

## 8. Edit on Windows, build in WSL (optional)

You can keep the repo on `C:` for editing in Cursor and **only run** `pnpm install` / `dist:linux` in a clone under `~/dev` that you `git pull` in WSL—or use a single clone under `\\wsl$\Ubuntu\home\<you>\dev\ai-media-library` from Windows. Avoid running `dist:linux` from **PowerShell** on the Windows tree: native addons must be built for **Linux**, not Windows.
