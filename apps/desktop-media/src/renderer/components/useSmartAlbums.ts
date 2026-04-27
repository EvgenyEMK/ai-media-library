import { useState, type Dispatch, type SetStateAction } from "react";
import type {
  AlbumMediaItem,
  SmartAlbumFilters,
  SmartAlbumPlaceCountry,
  SmartAlbumPlaceEntry,
  SmartAlbumYearSummary,
} from "@emk/shared-contracts";
import type { SmartAlbumSettings } from "../../shared/ipc";

export const DEFAULT_SMART_ALBUM_FILTERS: SmartAlbumFilters = {
  includeUnconfirmedFaces: true,
  starRatingMin: 4,
  starRatingOperator: "gte",
  aiAestheticMin: 7,
  aiAestheticOperator: "gte",
  ratingLogic: "or",
};

export const EMPTY_SMART_ALBUM_FILTERS: SmartAlbumFilters = {
  includeUnconfirmedFaces: true,
  ratingLogic: "or",
};

function aiRatingStarsToAestheticMin(stars: number | null): number | undefined {
  if (!Number.isFinite(stars) || !stars || stars < 1) {
    return undefined;
  }
  return Math.min(10, Math.max(1, (Math.trunc(stars) - 1) * 2 + 1));
}

export function smartAlbumSettingsToFilters(settings: SmartAlbumSettings): SmartAlbumFilters {
  return {
    includeUnconfirmedFaces: true,
    starRatingMin: settings.defaultStarRating ?? undefined,
    starRatingOperator: settings.defaultStarRatingOperator,
    aiAestheticMin: aiRatingStarsToAestheticMin(settings.defaultAiRating),
    aiAestheticOperator: settings.defaultAiRatingOperator,
    ratingLogic: "or",
  };
}

export const BEST_OF_YEAR_RANDOM_CANDIDATE_LIMIT = 1000;

export type ActiveSmartAlbum =
  | {
      kind: "place";
      entry: SmartAlbumPlaceEntry;
    }
  | {
      kind: "best-of-year";
      year: string;
    }
  | null;

export function useSmartAlbums(defaultFilters = DEFAULT_SMART_ALBUM_FILTERS): {
  smartPlaceCountries: SmartAlbumPlaceCountry[];
  setSmartPlaceCountries: Dispatch<SetStateAction<SmartAlbumPlaceCountry[]>>;
  smartYears: SmartAlbumYearSummary[];
  setSmartYears: Dispatch<SetStateAction<SmartAlbumYearSummary[]>>;
  expandedSmartCountries: string[];
  setExpandedSmartCountries: Dispatch<SetStateAction<string[]>>;
  expandedSmartGroups: string[];
  setExpandedSmartGroups: Dispatch<SetStateAction<string[]>>;
  activeSmartAlbum: ActiveSmartAlbum;
  setActiveSmartAlbum: Dispatch<SetStateAction<ActiveSmartAlbum>>;
  smartItemsPage: number;
  setSmartItemsPage: Dispatch<SetStateAction<number>>;
  smartItems: AlbumMediaItem[];
  setSmartItems: Dispatch<SetStateAction<AlbumMediaItem[]>>;
  smartItemsTotal: number;
  setSmartItemsTotal: Dispatch<SetStateAction<number>>;
  smartAlbumFilters: SmartAlbumFilters;
  setSmartAlbumFilters: Dispatch<SetStateAction<SmartAlbumFilters>>;
  randomizeEnabled: boolean;
  setRandomizeEnabled: Dispatch<SetStateAction<boolean>>;
  randomRefreshKey: number;
  refreshRandomOrder: () => void;
  randomCandidateLimit: number;
} {
  const [smartPlaceCountries, setSmartPlaceCountries] = useState<SmartAlbumPlaceCountry[]>([]);
  const [smartYears, setSmartYears] = useState<SmartAlbumYearSummary[]>([]);
  const [expandedSmartCountries, setExpandedSmartCountries] = useState<string[]>([]);
  const [expandedSmartGroups, setExpandedSmartGroups] = useState<string[]>([]);
  const [activeSmartAlbum, setActiveSmartAlbum] = useState<ActiveSmartAlbum>(null);
  const [smartItemsPage, setSmartItemsPage] = useState(0);
  const [smartItems, setSmartItems] = useState<AlbumMediaItem[]>([]);
  const [smartItemsTotal, setSmartItemsTotal] = useState(0);
  const [smartAlbumFilters, setSmartAlbumFilters] = useState<SmartAlbumFilters>(defaultFilters);
  const [randomizeEnabled, setRandomizeEnabled] = useState(true);
  const [randomRefreshKey, setRandomRefreshKey] = useState(0);

  return {
    smartPlaceCountries,
    setSmartPlaceCountries,
    smartYears,
    setSmartYears,
    expandedSmartCountries,
    setExpandedSmartCountries,
    expandedSmartGroups,
    setExpandedSmartGroups,
    activeSmartAlbum,
    setActiveSmartAlbum,
    smartItemsPage,
    setSmartItemsPage,
    smartItems,
    setSmartItems,
    smartItemsTotal,
    setSmartItemsTotal,
    smartAlbumFilters,
    setSmartAlbumFilters,
    randomizeEnabled,
    setRandomizeEnabled,
    randomRefreshKey,
    refreshRandomOrder: () => setRandomRefreshKey((current) => current + 1),
    randomCandidateLimit: BEST_OF_YEAR_RANDOM_CANDIDATE_LIMIT,
  };
}
