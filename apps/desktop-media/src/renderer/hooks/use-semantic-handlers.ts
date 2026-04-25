import { useEffect, useMemo, useRef } from "react";
import type { SemanticSearchResult } from "@emk/media-store";
import {
  quickFiltersToSearchEventLocationExtras,
  type ThumbnailQuickFilterState,
} from "@emk/media-metadata-core";
import { passesAiImageSearchSimilarityGate } from "../lib/ai-search-similarity-gate";
import { parentPathWithTrailingSep } from "../lib/path-display";
import { refreshMetadataForItems } from "./ipc-binding-helpers";
import type { DesktopStore } from "../stores/desktop-store";

export function useSemanticHandlers(opts: {
  store: DesktopStore;
  semanticQuery: string;
  semanticResults: SemanticSearchResult[];
  semanticIndexJobId: string | null;
  quickFilters: ThumbnailQuickFilterState;
  setProgressPanelCollapsed: (collapsed: boolean) => void;
}): {
  handleSemanticSearch: () => Promise<void>;
  handleIndexSemantic: (
    folderPath: string,
    recursive: boolean,
    overrideExisting: boolean,
  ) => Promise<void>;
  handleCancelSemanticIndex: () => Promise<void>;
} {
  const { store, semanticQuery, semanticResults, semanticIndexJobId, quickFilters, setProgressPanelCollapsed } =
    opts;

  const semanticSearchVersionRef = useRef(0);
  const semanticSearchT0Ref = useRef(0);

  useEffect(() => {
    if (semanticResults.length > 0 && semanticSearchT0Ref.current > 0) {
      const elapsed = Date.now() - semanticSearchT0Ref.current;
      const msg = `[semantic-search][renderer][+${elapsed}ms] React rendered ${semanticResults.length} results in DOM`;
      window.desktopApi._logToMain(msg);
      requestAnimationFrame(() => {
        const paintElapsed = Date.now() - semanticSearchT0Ref.current;
        window.desktopApi._logToMain(`[semantic-search][renderer][+${paintElapsed}ms] browser paint frame`);
        semanticSearchT0Ref.current = 0;
      });
    }
  }, [semanticResults]);

  return useMemo(() => {
    const handleSemanticSearch = async (): Promise<void> => {
      const query = semanticQuery.trim();
      if (!query) return;
      if (store.getState().semanticSearching) return;

      const version = ++semanticSearchVersionRef.current;
      store.getState().setSemanticSearching(true);
      store.getState().setSemanticStatus("Searching...");
      try {
        const rendererT0 = Date.now();
        semanticSearchT0Ref.current = rendererT0;
        window.desktopApi._logToMain(`[semantic-search][renderer][${new Date().toISOString()}] search button clicked`);

        const currentState = store.getState();
        const scope = currentState.semanticSearchScope;
        const personTagIds = currentState.semanticPersonTagIds;
        const folderForScope = scope !== "global" ? currentState.selectedFolder : undefined;
        const recursive = scope === "recursive";

        const includeUnconfirmedFaces = currentState.semanticIncludeUnconfirmedFaces;
        const translateToEnglish = currentState.semanticTranslateToEnglish;
        const experimentalAdvancedSearch = currentState.aiImageSearchSettings.keywordMatchReranking;
        const shouldAnalyzeQuery = translateToEnglish || experimentalAdvancedSearch;
        const signalMode = experimentalAdvancedSearch
          ? currentState.semanticSearchSignalMode
          : "hybrid";
        const eventLoc = quickFiltersToSearchEventLocationExtras(quickFilters);
        const response = await window.desktopApi.semanticSearchPhotos({
          query,
          limit: 100,
          folderPath: folderForScope ?? undefined,
          recursive: folderForScope ? recursive : undefined,
          personTagIds: personTagIds.length > 0 ? personTagIds : undefined,
          includeUnconfirmedFaces: personTagIds.length > 0 ? includeUnconfirmedFaces : undefined,
          eventDateStart: eventLoc.eventDateStart,
          eventDateEnd: eventLoc.eventDateEnd,
          locationQuery: eventLoc.locationQuery,
          advancedSearch: shouldAnalyzeQuery,
          translateToEnglish,
          queryAnalysisModel: currentState.aiImageSearchSettings.searchPromptTranslationModel,
          signalMode,
          vlmSimilarityThreshold: currentState.aiImageSearchSettings.hideResultsBelowVlmSimilarity,
          descriptionSimilarityThreshold:
            currentState.aiImageSearchSettings.hideResultsBelowDescriptionSimilarity,
          keywordMatchReranking: currentState.aiImageSearchSettings.keywordMatchReranking,
          keywordMatchThresholdVlm: currentState.aiImageSearchSettings.keywordMatchThresholdVlm,
          keywordMatchThresholdDescription:
            currentState.aiImageSearchSettings.keywordMatchThresholdDescription,
        });
        const { results, queryAnalysis } = response;
        window.desktopApi._logToMain(
          `[semantic-search][renderer][+${Date.now() - rendererT0}ms] IPC response received: ${results.length} results`,
        );
        if (version !== semanticSearchVersionRef.current) return;
        const tVlm = currentState.aiImageSearchSettings.hideResultsBelowVlmSimilarity;
        const tDesc = currentState.aiImageSearchSettings.hideResultsBelowDescriptionSimilarity;
        const gateMode = currentState.aiImageSearchSettings.keywordMatchReranking
          ? currentState.semanticSearchSignalMode
          : "hybrid";
        const shownCount = results.filter((r) =>
          passesAiImageSearchSimilarityGate(r, tVlm, tDesc, gateMode),
        ).length;

        let statusText = `Found ${shownCount} result(s)`;
        if (queryAnalysis) {
          const parts: string[] = [];
          if (queryAnalysis.translated) {
            parts.push(`translated from ${queryAnalysis.originalLanguage}`);
          }
          if (queryAnalysis.keywords.length > 0) {
            parts.push(`keywords: ${queryAnalysis.keywords.join(", ")}`);
          }
          if (parts.length > 0) {
            statusText += ` (${parts.join("; ")})`;
          }
        }

        store.setState((s) => {
          s.semanticResults = results.map((r) => ({
            id: r.path,
            title: r.name,
            imageUrl: r.url,
            subtitle: parentPathWithTrailingSep(r.path),
            score: r.score,
            vlmSimilarity: r.vlmSimilarity,
            descriptionSimilarity: r.descriptionSimilarity,
            peopleDetected: r.peopleDetected,
            city: r.city,
            country: r.country,
            ageMin: r.ageMin,
            ageMax: r.ageMax,
          }));
          s.semanticStatus = statusText;
          s.semanticSearching = false;
        });
        void refreshMetadataForItems(
          store,
          results.map((r) => ({ id: r.path })),
        );
        window.desktopApi._logToMain(
          `[semantic-search][renderer][+${Date.now() - rendererT0}ms] store.setState done`,
        );
      } catch (error) {
        if (version !== semanticSearchVersionRef.current) return;
        const message = error instanceof Error ? error.message : "Semantic search failed.";
        window.desktopApi._logToMain(`[semantic-search][renderer] failed: ${message}`);
        store.setState((s) => {
          s.semanticStatus = message;
          s.semanticSearching = false;
        });
      }
    };

    const handleIndexSemantic = async (
      folderPath: string,
      recursive: boolean,
      overrideExisting: boolean,
    ): Promise<void> => {
      store.setState((s) => {
        s.semanticIndexError = null;
        s.semanticIndexStatus = "running";
        s.semanticIndexPanelVisible = true;
        s.semanticIndexJobId = null;
        s.semanticIndexItemOrder = [];
        s.semanticIndexItemsByKey = {};
        s.semanticIndexAverageSecondsPerFile = null;
        s.semanticIndexCurrentFolderPath = null;
        s.semanticIndexPhase = null;
      });
      setProgressPanelCollapsed(false);
      try {
        const result = await window.desktopApi.indexFolderSemanticEmbeddings({
          folderPath,
          mode: overrideExisting ? "all" : "missing",
          recursive,
        });
        store.setState((s) => {
          s.semanticIndexJobId = result.jobId;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Semantic indexing failed.";
        store.setState((s) => {
          s.semanticIndexError = message;
          s.semanticIndexStatus = "failed";
          s.semanticIndexPhase = null;
        });
      }
    };

    const handleCancelSemanticIndex = async (): Promise<void> => {
      if (!semanticIndexJobId) return;
      await window.desktopApi.cancelSemanticEmbeddingIndex(semanticIndexJobId);
    };

    return {
      handleSemanticSearch,
      handleIndexSemantic,
      handleCancelSemanticIndex,
    };
  }, [store, semanticQuery, semanticResults, semanticIndexJobId, quickFilters, setProgressPanelCollapsed]);
}
