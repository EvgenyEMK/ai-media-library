# PNPM Workspace Standards

This document defines package-manager and workspace conventions for the hybrid transition phase.

## Package Manager Policy

- Single package manager: `pnpm`
- Required lockfile: `pnpm-lock.yaml`
- Required root manifest field: `"packageManager": "pnpm@10.16.1"`
- Disallowed lockfiles: `package-lock.json`, `yarn.lock`

## Workspace Layout (Stage A)

- Root web app stays at repository root (`.`)
- Desktop app bootstrap lives in `apps/desktop-media`
- Shared cross-product contracts live in `packages/shared-contracts`
- Workspace declaration is managed via `pnpm-workspace.yaml`

## Script Conventions

- Root scripts are run as:
  - `pnpm dev`
  - `pnpm build`
  - `pnpm lint`
  - `pnpm test`
- Package-scoped scripts are run as:
  - `pnpm --filter <package-name> <script>`

## CLI Conventions

- Use `pnpm dlx` for one-off CLIs (for example Supabase repair commands).
- Use workspace dependencies where reuse is expected across products.

## CI Baseline (when CI is added)

Recommended baseline:

1. Install pnpm via corepack.
2. Restore pnpm store cache.
3. Run `pnpm install --frozen-lockfile`.
4. Run checks:
   - `pnpm lint`
   - `pnpm test`
   - `pnpm build`

Example CI command sequence:

```bash
corepack enable
corepack prepare pnpm@10.16.1 --activate
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
```
