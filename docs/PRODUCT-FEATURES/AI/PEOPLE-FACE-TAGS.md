# People Face Tags Experience

This document describes the user experience and **product-facing business rules** for the **People** section in **desktop media** (`DesktopPeopleSection` and related UI).

Related: [App Settings (desktop)](../media-library/APP-SETTINGS-UX.md) — face recognition threshold, **Find groups** clustering parameters, and persistence.  
Related: [Bottom app panel](../media-library/BOTTOM-APP-PANEL-UX.md) — background job for **People** similar-face count refresh.

---

## Overview

The People section has **four tabs**, in this order:

1. **People** — directory of all person tags (name, tagged count, similar-untagged count, groups).
2. **People groups** — named groups that reference person tags (organizational only; does not delete tags).
3. **Tagged faces** — pick a person, then **already-tagged** faces for that person plus **auto-detected** matching untagged faces.
4. **Untagged faces** — clusters of untagged faces and batch assign/naming workflows.

The goal is to make confirmation workflows fast, accurate, and batch-friendly.

---

## People tab (directory)

### Columns

- **Name** — person tag label (editable). Header includes a **quick name filter** (same filter control pattern as **Tagged faces**, but in table header form with a visible **Name** column label).
- **Tagged faces** — count of face instances already assigned this tag.
- **Similar faces** — count of **untagged** face instances whose embedding is similar enough to this person’s **centroid** at the **current** face-recognition threshold (same definition as “auto-detected” matching in Tagged faces / `findMatchesForPerson` with no limit).

### Pin (shared with Tagged faces)

- A person tag can be **pinned** (persisted on the tag).
- In the **People** directory, pinned people are sorted ahead of unpinned (then by name).
- In **Tagged faces**, the **collapsed** person-tag chip list **always includes every pinned person** (see [Person tag chips](#person-tag-chips)). Pins are the same database flag in both places.

### Business logic: cached vs live counts

- **Default display (no extra work on tab switch):** The Similar faces column shows values from the **library cache** (`person_centroids.similar_untagged_face_count`), populated when suggestion refresh runs for that tag (`refreshSuggestionsForTag`). The cache is updated with the threshold in effect at that refresh; it can be stale if embeddings, untagged faces, the centroid, or **Settings → Face recognition → Similarity threshold for suggesting a person** changed since then (see [App Settings](../media-library/APP-SETTINGS-UX.md) §6).
- **Live recompute (authoritative for current settings):** Click **Refresh** in the page header. This reloads the people list (and groups map) **and** starts a **background job** that recomputes similar counts **only for the current pagination page** (10 tags per page). Progress appears in **Background operations** (bottom dock): progress bar, per-tag advancement, **Cancel** (`X` while running). On **successful completion**, that card **auto-hides** (same pattern as metadata scan when there are no catalog changes). Failed jobs leave the card until dismissed.

### Pagination

- Changing pages does **not** start a live job. To refresh similar counts for another page, navigate there and click **Refresh**.

---

## People groups tab

### Purpose

- **People groups** are **named collections of person tags**. They help organize many people (e.g. household, project) without changing face tags or files.
- **Deleting a group** removes only the **grouping**; it does **not** delete person tags or face assignments.

### UX

- **Create:** Enter a name and create; empty groups are allowed.
- **Members:** Each assigned person appears as a **membership chip** (same chip pattern as the **People** directory **Groups** column). Removing someone from a chip **removes them from this group only**.
- **Group row:** **Edit** and **Delete** for the group appear on **hover** (and **focus-within** on the row) on larger breakpoints so the list stays calm; small screens keep actions visible.
- **Refresh** reloads groups and membership.

### Business logic

- Group membership is stored separately from `media_tags`; person tags remain global to the library.
- Lists such as **People → Groups** and **People groups** use the same underlying group APIs.

---

## Tagged faces tab

### Person tag chips

**Layout**

- Under the **Person tags** heading, controls and chips sit on **one wrapping row** (`flex` + `flex-wrap`, aligned center): **name filter** → **Show all / Hide all** (one toggle button, label switches) → **person tag chips**. On narrow widths or **Show all**, content flows to **multiple lines** naturally.

**Name filter**

- Compact search field with placeholder **Name** (no separate “Name” label in this tab). Same underlying filter pattern as the **People** table name filter.
- **Escape** clears the filter when it is non-empty.

**Show all / Hide all**

- **Show all** appears only when the **collapsed** chip set is smaller than the full person-tag list and the name filter is **empty**. It sits **immediately after** the search field.
- **Hide all** appears in the **same slot** while the list is **expanded**, and collapses back to the shortened chip set.

**Data**

- The tab loads person tags with **face counts and pin state** (`listPersonTagsWithFaceCounts`) so the UI can rank by **tagged face count** and respect **pins** without extra round-trips.

**Collapsed chip list (default, no name filter)**

1. If **any** person is **pinned**: show **all pinned** people (sorted by name), then up to **three** additional **non-pinned** people from a **most-recently-used** list (see below). Pinned people are never duplicated in the MRU tail.
2. If **no** person is pinned: show the **top five** people by **tagged face count** (ties broken by name), merged with the MRU list (MRU first, then fill toward five distinct people).

**Name filter active (non-empty)**

- Chips show **every person whose name matches** the filter (case-insensitive substring).
- Choosing a chip **selects** that person (updates tagged faces and auto-matches below), **clears the name filter**, and, if the person is **not pinned**, adds them to the **MRU** list (up to **three** ids, newest-first). That MRU list is what supplies the extra non-pinned chips after pins when collapsed.

**Selection visibility**

- The **currently selected** person is **always** shown as a chip if they exist in the library, even when they would not appear in the collapsed or filtered set (chip is appended for clarity).

### Person selection (downstream panels)

- After a person is selected, the page shows:
  - **Tagged faces** for that person (see [Tagged faces grid](#tagged-faces-grid) below).
  - **Auto-detected matching faces** (untagged candidates inferred from embeddings).

### Tagged faces grid

- On desktop, tagged faces for the selected person use **pagination**: **25** thumbnails per page in a **5×5** grid, with **Previous / Next** and a range label (e.g. `1–25 of N`). This replaces an older “first N + More” pattern.

### Auto-detected matching faces layout

- Faces are rendered in rows of exactly **5** faces where possible.
- Each row includes large left-side controls:
  - **Row Accept (Check)**: assigns the selected person tag to all non-excluded faces in that row.
  - **Row Exclude (Cross)**: toggles excluded state for all faces in the row.
- Each face includes compact controls under the thumbnail:
  - **Hide (Cross)**: excludes/includes that face from row acceptance.
  - **Similarity %**: shown inline next to the hide control.

### Behavioral details

- The old per-card text actions are removed for speed-first icon workflows.
- File names and generic "Face #" labels are hidden in this section.
- Row accept respects row-level and face-level exclusion state.
- Accepted rows stay visible in-place and the row check turns green.
- If a row is fully excluded, per-face hide controls are hidden for that row.
- Users can exclude a few wrong faces in a row, then accept the row once.
- After assignment, assigned faces are removed from candidate results.

---

## Shared UX Rules

- Face thumbnails are intentionally larger for quick visual recognition.
- Hovering a face thumbnail opens a larger preview of the source photo.
- Hover preview placement is automatic:
  - If there is enough space on the right, preview opens to the right.
  - Otherwise, preview opens to the left.
- Excluded faces are visually de-emphasized using **strong opacity (0.2) + slight blur** (not grayscale).
- Acceptance is **row-first**. Users accept rows, while face-level controls are used to exclude/include faces.

---

## Untagged faces tab

### Similarity filters (when a target person is selected)

- **Show** filters use the same centroid metric as elsewhere, with bands derived from the app threshold **X** (cosine, 0–1): **Matching ≥ X%**, **Y%–X%** where **Y = max(0, X − 10)** percentage points on that scale, and **Below Y%**.
- Thumbnails are ordered by **similarity to that person’s centroid** (highest first), including in **All** when a target person is selected.
- Pagination totals for filtered views reflect the filtered set, not the raw cluster member count alone.

### Cluster cards

- Each cluster shows:
  - Representative face
  - Member count
  - Optional suggested person match
  - Target-tag controls (existing tag, suggested tag shortcut, or create new tag)

### Expanded cluster workflow

- When a cluster is expanded, faces are shown in rows of up to **5**.
- Each row supports:
  - **Row Accept**: assigns all non-excluded faces in that row to the selected target tag.
  - **Row Exclude**: toggles exclusion for all row faces.
- Each face supports:
  - **Face Hide (Cross)**: toggles exclusion only for that face.

### Shared interaction component

- Tagged faces and Untagged faces tabs both use one shared face-footer control for hide/exclude behavior.
- This keeps icon behavior, selected red state, and row-level hiding of per-face details consistent.

### Target tag rules

- A target tag must be selected before accepting faces.
- Suggested match can be used as a one-click target selection.
- Creating a new person name sets it as the target for continued row/face acceptance.

---

## Suggested Match Behavior

- Suggestions are based on embedding similarity between an unnamed cluster centroid and existing person centroids.
- Suggestions are shown as helper guidance, not forced actions.
- User can always override by choosing another person tag.

---

## Error and Safety Behavior

- Assignment actions are disabled while relevant assignment requests are in progress.
- If target tag is missing, the UI prompts the user to select or create one.
- Partial selection and iterative cleanup are supported (exclude first, then accept row).

---

## Implementation references (for engineers)

| Area | Primary locations |
|------|-------------------|
| Tab order & shell | `apps/desktop-media/src/renderer/components/DesktopPeopleSection.tsx` |
| People directory | `DesktopPeopleTagsListTab`, `use-desktop-people-tags-list`, `people-tags-name-search-header` |
| People groups | `DesktopPeopleGroupsTab`, `use-desktop-people-groups-tab`, `people-membership-chip` |
| Tagged faces workspace | `DesktopPeopleWorkspace`, `tagged-faces-tab-visible-tags.ts` |
| Shared face workspace layout | `packages/media-viewer/src/people-face-workspace.tsx` |
| Person tags + counts (IPC) | `listPersonTagsWithFaceCounts`, `face-tags.ts` |

---

## Document history

- **2026-04:** Document **People groups** tab; **tab order** People → People groups → Tagged faces → Untagged faces; **Tagged faces** person-tag **filter**, **pin / top-5 collapsed list**, **MRU (3) after pins**, **inline Show all–Hide all**, **5×5 paged tagged faces** (25 per page). Aligns with commits `1fd6ef8`, `cd993c6`, and follow-up UX refinements on `dev`.
