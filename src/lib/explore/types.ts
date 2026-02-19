export type ExploreItemType = "post" | "ad" | "account_suggestion";

export interface ExplorePostItem {
  type: "post";
  id: string;
  post: {
    id: string;
    author_id: string;
    content: string;
    tags: string[];
    created_at: string;
    profiles: {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
      role: string;
    };
    post_media: {
      id: string;
      url: string;
      media_type: "image" | "video";
      thumbnail_url: string | null;
      sort_order: number;
    }[];
    post_likes: { user_id: string }[];
    comments: { id: string }[];
  };
  score: number;
  source: "suggested" | "nearby";
}

export interface ExploreAdItem {
  type: "ad";
  id: string;
  ad: {
    id: string;
    advertiser_name: string;
    title: string;
    body: string | null;
    image_url: string | null;
    click_url: string;
    tags: string[];
  };
}

export interface ExploreAccountItem {
  type: "account_suggestion";
  id: string;
  account: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    discipline: string | null;
    rider_level: string | null;
    bio: string | null;
  };
  reason: string;
}

export type ExploreItem = ExplorePostItem | ExploreAdItem | ExploreAccountItem;

export interface ExploreFeedResult {
  items: ExploreItem[];
  nextCursor: string | null;
  hasMore: boolean;
}
