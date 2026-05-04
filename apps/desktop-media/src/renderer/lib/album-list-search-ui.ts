/** Debounce for album list Title / Location / From / To (person tag selection is immediate). */
const ALBUM_LIST_SEARCH_FIELD_DEBOUNCE_BASE_MS = 300;
export const ALBUM_LIST_SEARCH_FIELD_DEBOUNCE_MS = ALBUM_LIST_SEARCH_FIELD_DEBOUNCE_BASE_MS * 2;

/**
 * Max width for the album Title field: matches `PeopleTagsNameSearchRow` name input (13.333rem) +
 * `gap-2` + approximate "Show all" / "Hide all" control so the Title input ends with that toolbar.
 */
export const ALBUM_LIST_TITLE_INPUT_MAX_CLASS = "w-full max-w-[min(100%,calc(13.333rem+0.5rem+6.75rem))]";

/** Narrower secondary location field on the album list search panel. */
export const ALBUM_LIST_LOCATION_INPUT_MAX_CLASS = "w-full max-w-[min(100%,12rem)]";
