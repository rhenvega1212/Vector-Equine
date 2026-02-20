export interface ExploreConfig {
  /** How many items per page */
  defaultLimit: number;
  /** Max items per page */
  maxLimit: number;
  /** Insert one ad every N items (0 = no ads) */
  adInterval: number;
  /** How many days before a seen post can reappear */
  seenCooldownDays: number;
  /** Ratio of suggested vs nearby content (0.0–1.0). 0.7 = 70% suggested, 30% nearby */
  suggestedRatio: number;
  /** Max account suggestions to interleave per page */
  maxAccountSuggestionsPerPage: number;
  /** Position of first account suggestion card (0-indexed within the page) */
  accountSuggestionStartIndex: number;
  /** Interval between account suggestion cards */
  accountSuggestionInterval: number;
  /** Weight multiplier for interest-tag match when scoring posts */
  interestWeight: number;
  /** Weight multiplier for recency (hours decay) */
  recencyWeight: number;
  /** Weight multiplier for engagement (likes + comments) */
  engagementWeight: number;
  /** Small boost for same-city/geohash nearby content */
  nearbyBoost: number;
  /** Max hours old for recency scoring (older posts get 0 recency score) */
  recencyMaxHours: number;
  /** Number of trending posts to push at top of explore (first page only) */
  trendingCount: number;
  /** Number of admin posts to push at top of explore (first page only) */
  adminCount: number;
}

export const DEFAULT_EXPLORE_CONFIG: ExploreConfig = {
  defaultLimit: 20,
  maxLimit: 50,
  adInterval: 8,
  seenCooldownDays: 7,
  suggestedRatio: 0.7,
  maxAccountSuggestionsPerPage: 3,
  accountSuggestionStartIndex: 3,
  accountSuggestionInterval: 6,
  interestWeight: 3.0,
  recencyWeight: 1.5,
  engagementWeight: 1.0,
  nearbyBoost: 0.5,
  recencyMaxHours: 168, // 7 days
  trendingCount: 6,
  adminCount: 4,
};
