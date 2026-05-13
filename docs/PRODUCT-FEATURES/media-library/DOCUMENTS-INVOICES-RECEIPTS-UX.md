# Documents — Invoices & Receipts (desktop)

## Scope

This document describes the **Documents** area of the **left main sidebar** in `apps/desktop-media` and the **Invoices & Receipts** workspace: catalog-wide table, filters, pagination, and onboarding help.

Per-item **Invoice / receipt** fields in the photo viewer **Info** tab remain documented in [Photo with info panel](./media-library-photo-info-panel.md).

---

## 1) Sidebar: Documents

- **Location:** Primary section in the main app sidebar (same pattern as **Folders**, **Albums**, **People**, **Insights**, **Settings**).
- **Label:** **Documents** (file-text style icon).
- **Behavior:** Tapping the section header expands or collapses **Documents**; when expanded, a nested navigation row appears for **Invoices & Receipts**.
- **Collapsed sidebar:** The **Documents** icon remains reachable; the active subsection is reflected on the icon when **Invoices & Receipts** is selected (same idea as **Insights** sub-routes).

---

## 2) Sub-section: Invoices & Receipts

- **Label:** **Invoices & Receipts**.
- **Selection:** Opens the **Invoices & Receipts** workspace in the main panel (replaces folder grid, albums, people list, etc., for that session).
- **Heading:** The workspace title matches **Invoices & Receipts**.

---

## 3) Data sources and empty library

- **Real rows:** The table lists media items whose AI analysis identifies them as **invoice or receipt** documents (library-wide, not limited to the currently selected folder).
- **No qualifying items in the catalog:** The app shows a fixed **sample** table so layout and columns are discoverable, plus a prominent **status** banner explaining that rows are **example only** until **AI image analysis** has been run on the library and invoice/receipt items exist.
- **Errors loading count or rows:** A destructive-styled message is shown; the sample table may still appear as a fallback when the catalog count cannot be loaded.

---

## 4) Toolbar and search filters

When the catalog has at least one invoice/receipt row:

- **Help:** A **help** control next to the title opens an **About Invoices & Receipts** modal (guided content: what the table is, how analysis populates it, and model note using the effective photo-analysis model name).
- **Filter toggle:** A **search / filters** toolbar control opens or closes the filter strip. It shows a **badge** with the number of **active** filters when any filter is applied.
- **Filter panel** (when open): Dismissible with **Close invoice filters**. Fields (values debounce before querying):
  - **Issued by** — text contains match on issuer/vendor.
  - **Date from** / **Date to** — document date range (structured date inputs).
  - **Total from** / **Total to** — numeric range on totals (decimal input).
  - **Currency** — up to three letters, normalized to uppercase (ISO-style code).
- **Default:** With real catalog data, the filter panel starts **open**; with zero rows the panel stays closed because sample mode does not apply server filters.

---

## 5) Table

- **Columns:** **Preview** (optional thumbnails), **Issuer**, **Date**, **Total**, **VAT** (labels match in-app copy).
- **Thumbnails:** Column can be expanded or collapsed via **Show thumbnails** / **Hide thumbnails** in the header; sample rows show a **Sample** placeholder when no file is attached.
- **Row actions:** Activating a row opens that media item in the viewer (same flow as opening from the library grid).
- **Consistency hints:** For real rows, totals and VAT may show inline **Wrong?** / consistency hints when parsed amounts look suspicious (see implementation in `invoice-receipt-amount-warnings`).
- **No matches:** When filters exclude everything, an empty state message explains that nothing matched.

---

## 6) Pagination

- With real catalog data, results are **paged** (same page size convention as album list views).
- **Sample mode** does not show pagination (fixed short sample list).

---

## Related

- Quick filter **Documents** on thumbnails (invoice vs ID classes): [AI search (desktop)](../AI/AI-SEARCH-DESKTOP.md).
- Photo viewer **Invoice / receipt** block: [Photo with info panel](./media-library-photo-info-panel.md).
