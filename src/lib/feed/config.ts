export interface HomeFeedConfig {
  defaultLimit: number;
  maxLimit: number;
  /** Insert one ad every N organic posts (0 = no ads) */
  adInterval: number;
  /** How many days before a seen post can reappear */
  seenCooldownDays: number;
  /** Mix in one suggested post every N followed posts */
  suggestedMixInterval: number;
  /** Max hours for followed-post recency decay */
  followedRecencyMaxHours: number;
  /** Max hours for suggested-post recency decay */
  suggestedRecencyMaxHours: number;

  followedRecencyWeight: number;
  followedEngagementWeight: number;
  followedRelationshipWeight: number;

  suggestedRecencyWeight: number;
  suggestedEngagementWeight: number;
  suggestedInterestWeight: number;
}

export const DEFAULT_HOME_FEED_CONFIG: HomeFeedConfig = {
  defaultLimit: 10,
  maxLimit: 30,
  adInterval: 6,
  seenCooldownDays: 7,
  suggestedMixInterval: 5,
  followedRecencyMaxHours: 168,  // 7 days
  suggestedRecencyMaxHours: 336, // 14 days

  followedRecencyWeight: 40,
  followedEngagementWeight: 30,
  followedRelationshipWeight: 30,

  suggestedRecencyWeight: 30,
  suggestedEngagementWeight: 35,
  suggestedInterestWeight: 35,
};
