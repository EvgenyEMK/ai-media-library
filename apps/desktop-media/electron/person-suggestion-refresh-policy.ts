/**
 * After tagging faces for a person, a full `refreshSuggestionsForTag` scan is expensive.
 * Run it only while the person has relatively few confirmed tags so the centroid stabilizes early.
 */
export const EARLY_SUGGESTION_REFRESH_MAX_TAGGED_FACES = 20;
