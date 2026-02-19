export interface HomeFeedPostItem {
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
    post_saves?: { user_id: string }[];
    comments: { id: string }[];
  };
  score: number;
  source: "followed" | "suggested";
}

export interface HomeFeedAdItem {
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

export type HomeFeedItem = HomeFeedPostItem | HomeFeedAdItem;

export interface HomeFeedResult {
  items: HomeFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface HomeFeedCursorData {
  seenPostIds: string[];
  seenAdIds: string[];
  organicCount: number;
  adCount: number;
}
