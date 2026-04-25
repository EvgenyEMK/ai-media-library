import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { X } from "lucide-react";
import { passesAiImageSearchSimilarityGate } from "../lib/ai-search-similarity-gate";
import { cn } from "../lib/cn";
import { UI_TEXT } from "../lib/ui-text";
import { useDesktopStore, useDesktopStoreApi } from "../stores/desktop-store";
import type { SemanticSearchScope, SemanticSearchSignalMode } from "@emk/media-store";
import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";
import type { PersonTagListMeta } from "../lib/tagged-faces-tab-visible-tags";
import { SemanticSearchPersonTagsBar } from "./semantic-search-person-tags-bar";

interface SemanticSearchPanelProps {
  onSearch: () => void;
}

const scopeLabelClass = (active: boolean): string =>
  cn(
    "flex cursor-pointer select-none items-center gap-1 text-xs text-ai-search-text/80 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40",
    active && "font-medium text-ai-search-text",
  );

const panelButtonClass =
  "inline-flex h-9 items-center justify-center rounded-md border border-ai-search-border bg-ai-search-control px-3 text-sm text-ai-search-text shadow-none transition-colors hover:border-ai-search-accent/60 hover:bg-ai-search-control/80 disabled:cursor-not-allowed disabled:opacity-45";

export function SemanticSearchPanel({
  onSearch,
}: SemanticSearchPanelProps): ReactElement {
  const store = useDesktopStoreApi();
  const semanticQuery = useDesktopStore((s) => s.semanticQuery);
  const semanticResults = useDesktopStore((s) => s.semanticResults);
  const semanticSearching = useDesktopStore((s) => s.semanticSearching);
  const semanticStatus = useDesktopStore((s) => s.semanticStatus);
  const hideVlm = useDesktopStore((s) => s.aiImageSearchSettings.hideResultsBelowVlmSimilarity);
  const hideDesc = useDesktopStore(
    (s) => s.aiImageSearchSettings.hideResultsBelowDescriptionSimilarity,
  );
  const experimentalAdvancedSearch = useDesktopStore(
    (s) => s.aiImageSearchSettings.keywordMatchReranking,
  );
  const semanticSearchScope = useDesktopStore((s) => s.semanticSearchScope);
  const semanticPersonTagIds = useDesktopStore((s) => s.semanticPersonTagIds);
  const semanticIncludeUnconfirmedFaces = useDesktopStore((s) => s.semanticIncludeUnconfirmedFaces);
  const semanticTranslateToEnglish = useDesktopStore((s) => s.semanticTranslateToEnglish);
  const semanticSearchSignalMode = useDesktopStore((s) => s.semanticSearchSignalMode);
  const selectedFolder = useDesktopStore((s) => s.selectedFolder);
  const semanticPanelOpen = useDesktopStore((s) => s.semanticPanelOpen);

  const [personTagsWithCounts, setPersonTagsWithCounts] = useState<DesktopPersonTagWithFaceCount[]>(
    [],
  );

  useEffect(() => {
    if (!semanticPanelOpen) {
      return;
    }
    void window.desktopApi.listPersonTagsWithFaceCounts().then(setPersonTagsWithCounts);
  }, [semanticPanelOpen]);

  const tagsMeta = useMemo((): PersonTagListMeta[] => {
    return personTagsWithCounts.map((tag) => ({
      id: tag.id,
      label: tag.label,
      pinned: tag.pinned,
      taggedFaceCount: tag.taggedFaceCount,
    }));
  }, [personTagsWithCounts]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter" && !semanticSearching && semanticQuery.trim()) {
      event.preventDefault();
      onSearch();
    }
  };

  const handleScopeChange = (scope: SemanticSearchScope): void => {
    store.getState().setSemanticSearchScope(scope);
  };

  const togglePersonTag = (tagId: string): void => {
    const current = semanticPersonTagIds;
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    store.getState().setSemanticPersonTagIds(next);
  };

  const hasFolderScope = semanticSearchScope !== "global";

  const effectiveSearchSignalMode = experimentalAdvancedSearch
    ? semanticSearchSignalMode
    : "hybrid";

  const shownResultsCount = useMemo(
    () =>
      semanticResults.filter((r) =>
        passesAiImageSearchSimilarityGate(r, hideVlm, hideDesc, effectiveSearchSignalMode),
      ).length,
    [semanticResults, hideVlm, hideDesc, effectiveSearchSignalMode],
  );

  const statusLabel =
    semanticSearching
      ? semanticStatus
      : semanticResults.length > 0
        ? `Found ${shownResultsCount} result(s)`
        : semanticStatus;

  return (
    <section className="shrink-0 border-b border-ai-search-border bg-ai-search-panel px-4 py-2.5 text-ai-search-text">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-semibold">{UI_TEXT.semanticPanelTitle}</h2>
        <div className="analysis-header-actions flex items-center gap-2">
          <span className="text-sm text-ai-search-muted">{statusLabel}</span>
          <button
            type="button"
            className="border-0 bg-transparent p-1 text-ai-search-text shadow-none hover:bg-ai-search-control/70"
            title={UI_TEXT.semanticClose}
            aria-label={UI_TEXT.semanticClose}
            onClick={() => store.getState().setSemanticPanelOpen(false)}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <div className="flex w-full flex-nowrap items-center gap-2">
          <input
            value={semanticQuery}
            onChange={(event) => store.getState().setSemanticQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={UI_TEXT.semanticSearchPlaceholder}
            className="min-w-0 flex-1 rounded-md border border-ai-search-border bg-ai-search-control px-3 py-1.5 text-left text-[15px] text-ai-search-text shadow-none placeholder:text-ai-search-muted/75 focus:border-ai-search-accent focus:outline-none focus:ring-1 focus:ring-ai-search-accent/45"
          />
          <div className="relative flex shrink-0 gap-2">
            <button
              type="button"
              className={panelButtonClass}
              onClick={onSearch}
              disabled={semanticSearching || !semanticQuery.trim()}
            >
              {UI_TEXT.semanticSearch}
            </button>
            <button
              type="button"
              className={panelButtonClass}
              onClick={() => {
                store.setState((s) => {
                  s.semanticResults = [];
                  s.semanticStatus = null;
                });
              }}
              disabled={semanticResults.length === 0}
            >
              {UI_TEXT.semanticClear}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-x-2 gap-y-1">
          <div
            className="m-0 flex min-w-0 flex-[0_1_auto] flex-wrap items-center gap-x-3 gap-y-1.5 border-0 p-0 text-xs text-ai-search-muted"
            role="radiogroup"
            aria-labelledby="semantic-search-scope-label"
          >
            <span id="semantic-search-scope-label" className="m-0 mr-2 shrink-0 p-0 text-xs leading-relaxed text-ai-search-muted">
              Scope
            </span>
            <label className={scopeLabelClass(semanticSearchScope === "global")}>
              <input
                type="radio"
                className="cursor-pointer accent-[#6e9fff]"
                name="semantic-scope"
                value="global"
                checked={semanticSearchScope === "global"}
                onChange={() => handleScopeChange("global")}
              />
              Global
            </label>
            <label
              className={scopeLabelClass(hasFolderScope && semanticSearchScope === "selected")}
              title={!selectedFolder ? "Select a folder first" : undefined}
            >
              <input
                type="radio"
                className="cursor-pointer accent-[#6e9fff]"
                name="semantic-scope"
                value="selected"
                checked={semanticSearchScope === "selected"}
                disabled={!selectedFolder}
                onChange={() => handleScopeChange("selected")}
              />
              Selected folder
            </label>
            <label
              className={scopeLabelClass(hasFolderScope && semanticSearchScope === "recursive")}
              title={!selectedFolder ? "Select a folder first" : undefined}
            >
              <input
                type="radio"
                className="cursor-pointer accent-[#6e9fff]"
                name="semantic-scope"
                value="recursive"
                checked={semanticSearchScope === "recursive"}
                disabled={!selectedFolder}
                onChange={() => handleScopeChange("recursive")}
              />
              Selected folder with sub-folders
            </label>
          </div>

          <span className="mx-2.5 ml-3.5 h-5 w-px shrink-0 self-center bg-ai-search-border" aria-hidden="true" />

          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-ai-search-text/80">
            <input
              type="checkbox"
              className="cursor-pointer accent-ai-search-accent"
              checked={semanticTranslateToEnglish}
              onChange={(e) => store.getState().setSemanticTranslateToEnglish(e.target.checked)}
            />
            <span>Translate to English</span>
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-ai-search-border text-[11px] text-ai-search-muted"
              title="Search prompts work best in English; when enabled, Ollama translates other languages before searching."
              aria-label="Search prompts work best in English; when enabled, Ollama translates other languages before searching."
            >
              ?
            </span>
          </label>

          {experimentalAdvancedSearch ? (
            <>
              <span
                className="mx-2.5 ml-3.5 h-5 w-px shrink-0 self-center bg-ai-search-border"
                aria-hidden="true"
              />

              <label className="flex shrink-0 items-center gap-1.5 text-xs text-ai-search-text/80">
                <span className="shrink-0">{UI_TEXT.semanticSearchSignalModeLabel}</span>
                <select
                  className="max-w-[11.5rem] cursor-pointer rounded border border-ai-search-border bg-ai-search-control px-1.5 py-0.5 text-xs text-ai-search-text shadow-none focus:border-ai-search-accent focus:outline-none focus:ring-1 focus:ring-ai-search-accent/45"
                  aria-label={UI_TEXT.semanticSearchSignalModeLabel}
                  value={semanticSearchSignalMode}
                  onChange={(e) =>
                    store.getState().setSemanticSearchSignalMode(e.target.value as SemanticSearchSignalMode)
                  }
                >
                  <option value="hybrid">{UI_TEXT.semanticSearchSignalHybrid}</option>
                  <option value="vlm-only">{UI_TEXT.semanticSearchSignalVlmOnly}</option>
                  <option value="description-only">{UI_TEXT.semanticSearchSignalDescriptionOnly}</option>
                </select>
              </label>
            </>
          ) : null}
        </div>

        <SemanticSearchPersonTagsBar
          tagsMeta={tagsMeta}
          selectedTagIds={semanticPersonTagIds}
          onToggleTag={togglePersonTag}
        />

        {semanticPersonTagIds.length > 0 ? (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ai-search-text/80">
            <input
              type="checkbox"
              className="cursor-pointer accent-ai-search-accent"
              checked={semanticIncludeUnconfirmedFaces}
              onChange={(e) =>
                store.getState().setSemanticIncludeUnconfirmedFaces(e.target.checked)
              }
            />
            <span>Include unconfirmed similar faces</span>
          </label>
        ) : null}
      </div>
    </section>
  );
}
