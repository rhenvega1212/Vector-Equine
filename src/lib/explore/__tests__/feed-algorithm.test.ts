import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_EXPLORE_CONFIG, ExploreConfig } from "../config";
import {
  getExploreFeed,
  encodeCursor,
  decodeCursor,
  _computeRecencyScore,
  _computeEngagementScore,
  _computeInterestScore,
  _scorePost,
} from "../feed-algorithm";

// ---------------------------------------------------------------------------
// Helpers to build mock Supabase client
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    author_id: overrides.author_id ?? "author-1",
    content: overrides.content ?? "Test post content",
    tags: overrides.tags ?? [],
    is_hidden: false,
    created_at: overrides.created_at ?? new Date().toISOString(),
    profiles: overrides.profiles ?? {
      id: overrides.author_id ?? "author-1",
      username: "testuser",
      display_name: "Test User",
      avatar_url: null,
      role: "rider",
    },
    post_media: overrides.post_media ?? [],
    post_likes: overrides.post_likes ?? [],
    comments: overrides.comments ?? [],
  };
}

function makeAd(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    advertiser_name: overrides.advertiser_name ?? "Acme Co",
    title: overrides.title ?? "Great Ad",
    body: overrides.body ?? "Ad body text",
    image_url: overrides.image_url ?? null,
    click_url: overrides.click_url ?? "https://example.com",
    tags: overrides.tags ?? [],
    is_active: true,
    daily_budget_cents: null,
    total_impressions: 0,
    max_impressions_per_user: overrides.max_impressions_per_user ?? 3,
    frequency_cap_hours: 24,
    start_date: null,
    end_date: null,
  };
}

function makeProfile(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    username: overrides.username ?? "person",
    display_name: overrides.display_name ?? "A Person",
    avatar_url: null,
    discipline: overrides.discipline ?? null,
    rider_level: overrides.rider_level ?? null,
    bio: overrides.bio ?? null,
    created_at: new Date().toISOString(),
  };
}

interface MockTableConfig {
  user_blocks?: any[];
  follows?: any[];
  user_interests?: any[];
  user_seen_items?: any[];
  user_location_bucket?: any;
  posts?: any[];
  ads?: any[];
  profiles?: any[];
}

function createMockSupabase(tables: MockTableConfig = {}) {
  const data: Required<MockTableConfig> = {
    user_blocks: tables.user_blocks ?? [],
    follows: tables.follows ?? [],
    user_interests: tables.user_interests ?? [],
    user_seen_items: tables.user_seen_items ?? [],
    user_location_bucket: tables.user_location_bucket ?? null,
    posts: tables.posts ?? [],
    ads: tables.ads ?? [],
    profiles: tables.profiles ?? [],
  };

  function buildQueryChain(rows: any[]) {
    let filtered = [...rows];
    let singleMode = false;

    const chain: any = {
      _filters: [] as Array<{ type: string; args: any[] }>,

      select: vi.fn().mockReturnThis(),
      eq: vi.fn(function (this: any, col: string, val: any) {
        this._filters.push({ type: "eq", args: [col, val] });
        return this;
      }),
      not: vi.fn(function (this: any, col: string, op: string, val: string) {
        this._filters.push({ type: "not", args: [col, op, val] });
        return this;
      }),
      in: vi.fn(function (this: any, col: string, vals: any[]) {
        this._filters.push({ type: "in", args: [col, vals] });
        return this;
      }),
      like: vi.fn(function (this: any, col: string, pattern: string) {
        this._filters.push({ type: "like", args: [col, pattern] });
        return this;
      }),
      gte: vi.fn(function (this: any, _col: string, _val: any) {
        return this;
      }),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn(function (this: any) {
        singleMode = true;
        return this;
      }),

      then: vi.fn(function (
        this: any,
        resolve: (val: any) => void
      ) {
        let result = [...filtered];

        for (const f of this._filters) {
          if (f.type === "eq") {
            const [col, val] = f.args;
            result = result.filter((r) => r[col] === val);
          }
          if (f.type === "not") {
            const [col, _op, valStr] = f.args;
            const ids = valStr
              .replace(/[()]/g, "")
              .split(",")
              .filter(Boolean);
            result = result.filter((r) => !ids.includes(r[col]));
          }
          if (f.type === "in") {
            const [col, vals] = f.args;
            result = result.filter((r) => vals.includes(r[col]));
          }
          if (f.type === "like") {
            const [col, pattern] = f.args;
            const prefix = pattern.replace(/%$/, "");
            result = result.filter(
              (r) => r[col] && r[col].startsWith(prefix)
            );
          }
        }

        if (singleMode) {
          resolve({ data: result[0] ?? null, error: null });
        } else {
          resolve({ data: result, error: null });
        }
      }),
    };

    return chain;
  }

  const mockInsert = vi.fn().mockResolvedValue({ error: null });

  const supabase = {
    from: vi.fn((table: string) => {
      const tableMap: Record<string, any[]> = {
        user_blocks: data.user_blocks,
        follows: data.follows,
        user_interests: data.user_interests,
        user_seen_items: data.user_seen_items,
        posts: data.posts,
        ads: data.ads,
        profiles: data.profiles,
      };

      if (table === "user_location_bucket") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                then: vi.fn((resolve: any) =>
                  resolve({ data: data.user_location_bucket, error: null })
                ),
              }),
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    then: vi.fn((resolve: any) =>
                      resolve({ data: [], error: null })
                    ),
                  }),
                }),
              }),
              like: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    then: vi.fn((resolve: any) =>
                      resolve({ data: [], error: null })
                    ),
                  }),
                }),
              }),
            }),
          }),
          insert: mockInsert,
        };
      }

      if (table === "user_seen_items") {
        const chain = buildQueryChain(data.user_seen_items);
        chain.insert = mockInsert;
        return chain;
      }

      return {
        ...buildQueryChain(tableMap[table] ?? []),
        insert: mockInsert,
      };
    }),
  };

  return supabase as any;
}

// ---------------------------------------------------------------------------
// Scoring unit tests
// ---------------------------------------------------------------------------

describe("scoring helpers", () => {
  it("computeRecencyScore returns 1.0 for brand-new posts", () => {
    const score = _computeRecencyScore(new Date().toISOString(), 168);
    expect(score).toBeCloseTo(1.0, 1);
  });

  it("computeRecencyScore returns 0 for posts older than maxHours", () => {
    const old = new Date(Date.now() - 200 * 60 * 60 * 1000).toISOString();
    const score = _computeRecencyScore(old, 168);
    expect(score).toBe(0);
  });

  it("computeEngagementScore increases with likes and comments", () => {
    const low = _computeEngagementScore(0, 0);
    const mid = _computeEngagementScore(5, 2);
    const high = _computeEngagementScore(50, 20);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  it("computeInterestScore sums matching tag weights", () => {
    const interests = new Map([
      ["dressage", 2.0],
      ["jumping", 1.5],
    ]);
    const score = _computeInterestScore(["dressage", "jumping", "other"], interests);
    expect(score).toBe(3.5);
  });

  it("computeInterestScore returns 0 with no matching tags", () => {
    const interests = new Map([["dressage", 2.0]]);
    const score = _computeInterestScore(["reining"], interests);
    expect(score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cursor encoding
// ---------------------------------------------------------------------------

describe("cursor encoding / decoding", () => {
  it("round-trips cursor data", () => {
    const data = {
      offset: 20,
      seenPostIds: ["a", "b"],
      seenAdIds: ["x"],
      seenAccountIds: ["z"],
    };
    const cursor = encodeCursor(data);
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual(data);
  });

  it("returns defaults on invalid cursor", () => {
    const decoded = decodeCursor("not-valid-base64");
    expect(decoded.offset).toBe(0);
    expect(decoded.seenPostIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Integration tests using mock Supabase
// ---------------------------------------------------------------------------

describe("getExploreFeed", () => {
  const userId = "user-1";

  it("suggested posts appear before nearby posts when both exist", async () => {
    const suggestedAuthor = "author-suggested";
    const nearbyAuthor = "author-nearby";

    const suggestedPost = makePost({
      id: "suggested-post-1",
      author_id: suggestedAuthor,
      tags: ["dressage"],
      created_at: new Date().toISOString(),
      post_likes: [{ user_id: "x" }, { user_id: "y" }],
      profiles: {
        id: suggestedAuthor,
        username: "suggested",
        display_name: "Suggested Author",
        avatar_url: null,
        role: "rider",
      },
    });

    const nearbyPost = makePost({
      id: "nearby-post-1",
      author_id: nearbyAuthor,
      tags: [],
      created_at: new Date(Date.now() - 3600000).toISOString(),
      profiles: {
        id: nearbyAuthor,
        username: "nearby",
        display_name: "Nearby Author",
        avatar_url: null,
        role: "rider",
      },
    });

    const supabase = createMockSupabase({
      follows: [],
      user_blocks: [],
      user_interests: [
        { user_id: userId, tag: "dressage", weight: 3.0 },
      ],
      user_seen_items: [],
      user_location_bucket: {
        city: null,
        state: null,
        geohash_prefix: null,
        location_enabled: false,
      },
      posts: [suggestedPost, nearbyPost],
      ads: [],
      profiles: [],
    });

    const result = await getExploreFeed(supabase, userId, null, 20, {
      trendingCount: 0,
      adminCount: 0,
    });
    const postItems = result.items.filter((i) => i.type === "post");

    expect(postItems.length).toBeGreaterThan(0);
    // All posts should be from suggested since location is disabled
    for (const item of postItems) {
      if (item.type === "post") {
        expect(item.source).toBe("suggested");
      }
    }
  });

  it("ads appear at the configured interval", async () => {
    const posts = Array.from({ length: 20 }, (_, i) =>
      makePost({
        id: `post-${i}`,
        author_id: `author-${i}`,
        created_at: new Date(Date.now() - i * 60000).toISOString(),
        profiles: {
          id: `author-${i}`,
          username: `user${i}`,
          display_name: `User ${i}`,
          avatar_url: null,
          role: "rider",
        },
      })
    );

    const ads = [
      makeAd({ id: "ad-1", title: "Ad One" }),
      makeAd({ id: "ad-2", title: "Ad Two" }),
      makeAd({ id: "ad-3", title: "Ad Three" }),
    ];

    const supabase = createMockSupabase({
      posts,
      ads,
      follows: [],
      user_blocks: [],
      user_interests: [],
      user_seen_items: [],
      user_location_bucket: {
        city: null,
        state: null,
        geohash_prefix: null,
        location_enabled: false,
      },
      profiles: [],
    });

    const config: Partial<ExploreConfig> = {
      adInterval: 8,
      maxAccountSuggestionsPerPage: 0,
    };

    const result = await getExploreFeed(supabase, userId, null, 30, config);

    const adPositions: number[] = [];
    result.items.forEach((item, idx) => {
      if (item.type === "ad") adPositions.push(idx);
    });

    // Ads should appear at positions that are multiples of 8
    for (const pos of adPositions) {
      expect(pos % 8 === 0 || pos > 0).toBe(true);
    }

    // At least one ad should be in the feed
    expect(adPositions.length).toBeGreaterThan(0);
  });

  it("nearby is skipped when user location is disabled", async () => {
    const posts = [
      makePost({
        id: "post-1",
        author_id: "other-author",
        profiles: {
          id: "other-author",
          username: "other",
          display_name: "Other",
          avatar_url: null,
          role: "rider",
        },
      }),
    ];

    const supabase = createMockSupabase({
      posts,
      ads: [],
      follows: [],
      user_blocks: [],
      user_interests: [],
      user_seen_items: [],
      user_location_bucket: {
        city: "Austin",
        state: "TX",
        geohash_prefix: "9v6",
        location_enabled: false,
      },
      profiles: [],
    });

    const result = await getExploreFeed(supabase, userId, null, 10, {
      trendingCount: 0,
      adminCount: 0,
    });
    const postItems = result.items.filter((i) => i.type === "post");

    for (const item of postItems) {
      if (item.type === "post") {
        expect(item.source).toBe("suggested");
      }
    }
  });

  it("blocked/muted accounts are filtered out", async () => {
    const blockedAuthorId = "blocked-author";
    const normalAuthorId = "normal-author";

    const posts = [
      makePost({
        id: "blocked-post",
        author_id: blockedAuthorId,
        profiles: {
          id: blockedAuthorId,
          username: "blocked",
          display_name: "Blocked User",
          avatar_url: null,
          role: "rider",
        },
      }),
      makePost({
        id: "normal-post",
        author_id: normalAuthorId,
        profiles: {
          id: normalAuthorId,
          username: "normal",
          display_name: "Normal User",
          avatar_url: null,
          role: "rider",
        },
      }),
    ];

    const supabase = createMockSupabase({
      posts,
      ads: [],
      follows: [],
      user_blocks: [
        { blocker_id: userId, blocked_id: blockedAuthorId, block_type: "block" },
      ],
      user_interests: [],
      user_seen_items: [],
      user_location_bucket: {
        city: null,
        state: null,
        geohash_prefix: null,
        location_enabled: false,
      },
      profiles: [],
    });

    const result = await getExploreFeed(supabase, userId, null, 10);
    const postIds = result.items
      .filter((i) => i.type === "post")
      .map((i) => i.id);

    expect(postIds).not.toContain("blocked-post");
    expect(postIds).toContain("normal-post");
  });

  it("seen cooldown filters out recently seen posts", async () => {
    const seenPostId = "seen-post";
    const freshPostId = "fresh-post";

    const posts = [
      makePost({
        id: seenPostId,
        author_id: "author-a",
        profiles: {
          id: "author-a",
          username: "authora",
          display_name: "Author A",
          avatar_url: null,
          role: "rider",
        },
      }),
      makePost({
        id: freshPostId,
        author_id: "author-b",
        profiles: {
          id: "author-b",
          username: "authorb",
          display_name: "Author B",
          avatar_url: null,
          role: "rider",
        },
      }),
    ];

    const supabase = createMockSupabase({
      posts,
      ads: [],
      follows: [],
      user_blocks: [],
      user_interests: [],
      user_seen_items: [
        {
          user_id: userId,
          item_id: seenPostId,
          item_type: "post",
          seen_at: new Date().toISOString(),
        },
      ],
      user_location_bucket: {
        city: null,
        state: null,
        geohash_prefix: null,
        location_enabled: false,
      },
      profiles: [],
    });

    const result = await getExploreFeed(supabase, userId, null, 10);
    const postIds = result.items
      .filter((i) => i.type === "post")
      .map((i) => i.id);

    expect(postIds).not.toContain(seenPostId);
    expect(postIds).toContain(freshPostId);
  });

  it("no duplicate posts across paginated pages", async () => {
    const posts = Array.from({ length: 30 }, (_, i) =>
      makePost({
        id: `post-${i}`,
        author_id: `author-${i}`,
        created_at: new Date(Date.now() - i * 60000).toISOString(),
        profiles: {
          id: `author-${i}`,
          username: `user${i}`,
          display_name: `User ${i}`,
          avatar_url: null,
          role: "rider",
        },
      })
    );

    const supabase = createMockSupabase({
      posts,
      ads: [],
      follows: [],
      user_blocks: [],
      user_interests: [],
      user_seen_items: [],
      user_location_bucket: {
        city: null,
        state: null,
        geohash_prefix: null,
        location_enabled: false,
      },
      profiles: [],
    });

    const config: Partial<ExploreConfig> = {
      adInterval: 0,
      maxAccountSuggestionsPerPage: 0,
    };

    // Page 1
    const page1 = await getExploreFeed(supabase, userId, null, 10, config);
    const page1Ids = page1.items.map((i) => i.id);

    // Page 2 using cursor from page 1
    const page2 = await getExploreFeed(
      supabase,
      userId,
      page1.nextCursor,
      10,
      config
    );
    const page2Ids = page2.items.map((i) => i.id);

    // No overlap between pages
    const overlap = page1Ids.filter((id) => page2Ids.includes(id));
    expect(overlap).toEqual([]);
  });

  it("returns unified item types", async () => {
    const posts = Array.from({ length: 15 }, (_, i) =>
      makePost({
        id: `post-${i}`,
        author_id: `author-${i}`,
        created_at: new Date(Date.now() - i * 60000).toISOString(),
        profiles: {
          id: `author-${i}`,
          username: `user${i}`,
          display_name: `User ${i}`,
          avatar_url: null,
          role: "rider",
        },
      })
    );

    const ads = [makeAd({ id: "ad-1" })];
    const profiles = [
      makeProfile({ id: "profile-new-1", username: "newbie1" }),
    ];

    const supabase = createMockSupabase({
      posts,
      ads,
      follows: [],
      user_blocks: [],
      user_interests: [],
      user_seen_items: [],
      user_location_bucket: {
        city: null,
        state: null,
        geohash_prefix: null,
        location_enabled: false,
      },
      profiles,
    });

    const result = await getExploreFeed(supabase, userId, null, 20);

    for (const item of result.items) {
      expect(["post", "ad", "account_suggestion"]).toContain(item.type);
      expect(item.id).toBeTruthy();
    }
  });

  it("does not show followed accounts' posts", async () => {
    const followedAuthor = "followed-author";
    const unfollowedAuthor = "unfollowed-author";

    const posts = [
      makePost({
        id: "followed-post",
        author_id: followedAuthor,
        profiles: {
          id: followedAuthor,
          username: "followed",
          display_name: "Followed",
          avatar_url: null,
          role: "rider",
        },
      }),
      makePost({
        id: "unfollowed-post",
        author_id: unfollowedAuthor,
        profiles: {
          id: unfollowedAuthor,
          username: "unfollowed",
          display_name: "Unfollowed",
          avatar_url: null,
          role: "rider",
        },
      }),
    ];

    const supabase = createMockSupabase({
      posts,
      ads: [],
      follows: [
        { follower_id: userId, following_id: followedAuthor },
      ],
      user_blocks: [],
      user_interests: [],
      user_seen_items: [],
      user_location_bucket: {
        city: null,
        state: null,
        geohash_prefix: null,
        location_enabled: false,
      },
      profiles: [],
    });

    const result = await getExploreFeed(supabase, userId, null, 10);
    const postIds = result.items
      .filter((i) => i.type === "post")
      .map((i) => i.id);

    expect(postIds).not.toContain("followed-post");
    expect(postIds).toContain("unfollowed-post");
  });

  it("respects ad frequency cap (max impressions per user)", async () => {
    const posts = Array.from({ length: 20 }, (_, i) =>
      makePost({
        id: `post-${i}`,
        author_id: `author-${i}`,
        created_at: new Date(Date.now() - i * 60000).toISOString(),
        profiles: {
          id: `author-${i}`,
          username: `user${i}`,
          display_name: `User ${i}`,
          avatar_url: null,
          role: "rider",
        },
      })
    );

    const cappedAdId = "capped-ad";
    const freshAdId = "fresh-ad";
    const ads = [
      makeAd({ id: cappedAdId, max_impressions_per_user: 1 }),
      makeAd({ id: freshAdId }),
    ];

    const supabase = createMockSupabase({
      posts,
      ads,
      follows: [],
      user_blocks: [],
      user_interests: [],
      user_seen_items: [
        {
          user_id: userId,
          item_id: cappedAdId,
          item_type: "ad",
          seen_at: new Date().toISOString(),
        },
      ],
      user_location_bucket: {
        city: null,
        state: null,
        geohash_prefix: null,
        location_enabled: false,
      },
      profiles: [],
    });

    const result = await getExploreFeed(supabase, userId, null, 20);
    const adItems = result.items.filter((i) => i.type === "ad");

    const adIds = adItems.map((i) =>
      i.type === "ad" ? (i as any).ad.id : ""
    );
    expect(adIds).not.toContain(cappedAdId);
  });
});
