# Folder AI Analysis Summary Dashboard PRD

## Purpose

The Folder AI analysis summary should be useful at a glance before exposing the full per-folder pipeline table. The redesigned surface keeps the detailed table available, but defaults to a dashboard that answers the first user question: "Is this folder or folder tree ready?"

## Product Goals

- Replace the overwhelming initial table with a dashboard-style summary.
- Keep the existing detailed AI pipeline table reachable for inspection and corrective actions.
- Add geo-location coverage so GPS and reverse-geocoding readiness are visible alongside AI readiness.
- Keep the Summary dashboard fast enough for large library roots by loading smart-card groups progressively and loading row-level Details only when the user asks for them.
- Avoid misleading temporary zero or dash values while data is still pending; each card must keep its spinner until that card's own data has arrived.

## Entry Point

The view opens from the existing `Folder AI analysis summary` action in the sidebar folder row menu.

When this view is active, the normal folder content header is hidden. That means the folder name row, search/filter/grid/list buttons, action menu, and mini AI pipeline cards are not shown.

## Summary Header

The summary view owns its own header:

- Title is `Folder analysis summary` when the selected folder has no immediate subfolders.
- Title is `Folder tree analysis summary` when the selected folder has immediate subfolders.
- The selected folder path is shown below the title.
- Refresh and Close icon buttons appear on the right.
- Refresh reloads the report from the catalog.
- Close returns to the normal photo view.

## Default Dashboard

The dashboard is the default content for both flat folders and folder trees.

The first row shows media counts:

- Images
- Videos

The Images section shows status cards for:

- AI search index
- Face detection
- AI image analysis
- Wrongly rotated images

The Geo-location section shows a card for image/video GPS and reverse-geocoding coverage.

Status semantics match the existing details table:

- Green check means complete.
- Amber percent means partial completion.
- Dash means not done or not applicable.
- Secondary text shows completed counts, failed counts, issue counts, or GPS coverage when useful.
- Loading states use spinner-only indicators. In the Geo-location card, the Images and Videos sub-card loading state uses the same compact spinner size as the other dashboard status cards and does not show the word `Pending`.

Dashboard cards must update progressively as their backing data arrives:

- Images and Videos count cards should be the fastest visible data, backed by an aggregate catalog overview query for the selected scope.
- `Folder scan` / `Folder tree scan` should stay in its own loading state while scan freshness and direct child scan status are calculated.
- AI pipeline cards and the Geo-location card should stay in their own loading state while AI/GPS coverage is calculated.
- A slower card must not block faster cards from showing real data.
- Pending cards must show spinners, not placeholder values such as `0` or `—`.

## Folder Tree Tabs

The view shows tabs:

- `Summary`: default dashboard for the full selected folder tree.
- `Details: AI pipelines`: existing table-style view for AI search index, face detection, and AI image analysis.
- `Details: Geo-location`: table-style view for GPS and location detail coverage.

For folders without immediate subfolders, the details tabs still use the selected folder's direct scope. For folder trees, details include the selected subtree, selected direct-only row, and one recursively aggregated row per immediate child folder.

The Summary tab is optimized for fast progressive paint:

- Initial load separates media counts, folder scan freshness, and AI/GPS coverage so the dashboard can update individual smart-card groups as results arrive.
- Media count cards should not wait for filesystem inspection of child folders.
- `Folder tree scan` may load immediate child folder paths, but only to determine whether the selected folder has direct subfolders and to count direct subfolders whose own folder scan timestamp is missing.
- `Folder tree scan` must not perform deep recursive filesystem analysis of all descendants during Summary load.
- Details tab data is not requested during the initial Summary load.
- When the user first opens either Details tab, the app fetches the row-level summary report for both Details tabs. While that request is running, the tab displays a large spinner only, not `Loading summary...`.

## Folder Scan Freshness Card

The `Folder scan` / `Folder tree scan` dashboard card separates direct-folder readiness from subtree freshness:

- `Not scanned` is shown only for folder trees. It counts immediate child folders whose own `folder_analysis_status.metadata_scanned_at` value is missing because the row does not exist or the timestamp is `NULL`. It does not inspect grandchildren or other descendants for this count.
- `Oldest scan` is subtree-based. It uses the oldest non-null `metadata_scanned_at` across the selected folder and catalogued descendants in the selected folder tree.
- `Last data change` is subtree-based. It uses the latest `media_items.metadata_extracted_at` across catalogued image/video media under the selected folder tree.
- The card determines whether to use the `Folder tree scan` title from immediate child folder presence, not from a deep recursive descendant scan.
- The direct child folder list should be read with a lightweight directory listing. It should not check every child folder for nested subfolders as part of this dashboard card.

If `Not scanned` is greater than zero, the card uses the red/destructive treatment even when subtree date values are present.

## AI Details

The AI details tab preserves the existing table scopes:

- Total with sub-folders
- This folder without sub-folders
- One row per immediate subfolder, recursively aggregated

The existing run actions remain available from actionable AI status cells.

## Geo-location Details

The geo-location details tab mirrors the AI table row scopes.

Columns:

- Folder
- Images GPS coverage
- Videos GPS coverage
- Location details

GPS coverage cells show:

- Percentage with GPS
- With GPS count
- Without GPS count

`Location details` is separate from raw GPS presence. It represents media with GPS coordinates where reverse-geocoded catalog place fields have been extracted with `location_source = 'gps'`.

## Empty Folder Tree Behavior

When selecting a folder with no direct media items but one or more child folders, the app can automatically open `Folder tree analysis summary` instead of showing an empty media grid. This is controlled by the setting `On empty folder selection show AI analysis status summary for subfolders`.

Opening the summary this way, or from the sidebar folder row `Folder AI analysis summary` action, must not start an automatic direct-folder metadata scan. Empty direct folders with child folders have no direct media work to scan, and summary opening is intended to be read-only until the user explicitly clicks a scan or pipeline action.

## Dashboard Card Treatment

The implemented dashboard uses one stable geo card treatment:

- Top-level geo-location card.
- Split image/video rows inside the card.
- Each row shows location-details completion and GPS coverage.

## Data Contract

The folder summary data contract has progressive dashboard data plus lazy Details data.

Progressive dashboard load:

- Media overview for the selected recursive scope and selected direct-only scope. This powers Images and Videos count cards and should return independently from slower scan and coverage work.
- Folder tree scan summary for immediate child folder presence and direct child folders missing their own folder scan timestamp.
- AI/GPS coverage for the selected recursive scope and selected direct-only scope. This powers AI search index, face detection, AI image analysis, wrongly rotated images, and Geo-location cards.

Lazy Details load:

- Selected folder with subfolders
- Selected folder direct content only
- Immediate subfolders recursively

Geo coverage includes image and video totals, with-GPS counts, without-GPS counts, and location-details extraction status. AI coverage includes AI search index, face detection, AI image analysis, and wrongly rotated image analysis status.

## Acceptance Criteria

- Opening the summary view hides the normal folder content header.
- A summary-specific header shows the correct title, folder path, Refresh, and Close.
- The Summary tab is selected by default.
- Details tab data is lazy-loaded on first Details tab open and shows a spinner-only loading state.
- The AI details tab preserves existing table behavior and run actions.
- The geo details tab shows image GPS coverage, video GPS coverage, and location details by row scope.
- Refresh reloads the current summary data.
- Close returns to the photo view.
- Opening an empty-folder tree summary does not start an automatic direct-folder metadata scan.
- `Folder tree scan` reports missing scan status from direct subfolders only, while `Oldest scan` and `Last data change` remain subtree aggregate dates.
- Summary smart-cards render progressively: faster count cards must not wait for slower folder-tree scan or AI/GPS coverage queries.
- Pending smart-cards show spinners until their own data arrives and must not briefly display fake zero or dash values.
