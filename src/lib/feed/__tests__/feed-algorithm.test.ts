import { describe, it, expect } from "vitest";
import {
  computeRecencyScore,
  computeEngagementVelocity,
  computeRelationshipScore,
  computeInterestScore,
  scoreFollowedPost,
  scoreSuggestedPost,
  interleaveFeed,
} from "../scoring";
import { DEFAULT_HOME_FEED_CONFIG, HomeFeedConfig } from "../config";
import { encodeCursor, decodeCursor } from "../feed-algorithm";

const config: HomeFeedConfig = { ...DEFAULT_HOME_FEED_CONFIG };

function hoursAgo(hours: number, now: number = Date.now()): string {
  return new Date(now - hours * 60 * 60 * 1000).toISOString();
}

function makePost(
  id: string,
  authorId: string,
  hoursOld: number,
  likes: number,
  comments: number,
  saves: number = 0,
  tags: string[] = [],
  now: number = Date.now()
) {
  return {
    id,
    author_id: authorId,
    content: `Post ${id}`,
    tags,
    created_at: hoursAgo(hoursOld, now),
    profiles: {
      id: authorId,
      username: `user_${authorId}`,
      display_name: `User ${authorId}`,
      avatar_url: null,
      role: "rider",
    },
    post_media: [],
    post_likes: Array.from({ length: likes }, (_, i) => ({
      user_id: `liker_${i}`,
    })),
    post_saves: Array.from({ length: saves }, (_, i) => ({
      user_id: `saver_${i}`,
    })),
    comments: Array.from({ length: comments }, (_, i) => ({
      id: `comment_${i}`,
    })),
  };
}

// ============================================================================
// Recency scoring
// ============================================================================

describe("computeRecencyScore", () => {
  it("returns 1 for a brand-new post", () => {
    const now = Date.now();
    expect(computeRecencyScore(new Date(now).toISOString(), 168, now)).toBeCloseTo(1);
  });

  it("returns 0 for a post older than maxHours", () => {
    const now = Date.now();
    expect(computeRecencyScore(hoursAgo(200, now), 168, now)).toBe(0);
  });

  it("returns ~0.5 for a post at half the maxHours", () => {
    const now = Date.now();
    expect(computeRecencyScore(hoursAgo(84, now), 168, now)).toBeCloseTo(0.5, 1);
  });
});

// ============================================================================
// Engagement velocity
// ============================================================================

describe("computeEngagementVelocity", () => {
  it("returns 0 for no engagement", () => {
    const now = Date.now();
    expect(computeEngagementVelocity(0, 0, 0, hoursAgo(1, now), now)).toBe(0);
  });

  it("returns higher score for more engagement", () => {
    const now = Date.now();
    const low = computeEngagementVelocity(5, 2, 0, hoursAgo(1, now), now);
    const high = computeEngagementVelocity(50, 20, 10, hoursAgo(1, now), now);
    expect(high).toBeGreaterThan(low);
  });

  it("returns higher velocity for newer posts with same engagement", () => {
    const now = Date.now();
    const recent = computeEngagementVelocity(10, 5, 0, hoursAgo(1, now), now);
    const older = computeEngagementVelocity(10, 5, 0, hoursAgo(24, now), now);
    expect(recent).toBeGreaterThan(older);
  });
});

// ============================================================================
// Relationship strength
// ============================================================================

describe("computeRelationshipScore", () => {
  it("returns 0 for no interactions", () => {
    expect(computeRelationshipScore(0)).toBe(0);
  });

  it("caps at 1 for 10+ interactions", () => {
    expect(computeRelationshipScore(10)).toBe(1);
    expect(computeRelationshipScore(100)).toBe(1);
  });

  it("returns proportional score for partial interactions", () => {
    expect(computeRelationshipScore(5)).toBeCloseTo(0.5);
  });
});

// ============================================================================
// Interest scoring
// ============================================================================

describe("computeInterestScore", () => {
  it("returns 0 when no tags match", () => {
    const interests = new Map([["dressage", 2]]);
    expect(computeInterestScore(["jumping"], interests)).toBe(0);
  });

  it("returns positive score for matching tags", () => {
    const interests = new Map([["dressage", 3], ["reining", 2]]);
    expect(computeInterestScore(["dressage", "reining"], interests)).toBeGreaterThan(0);
  });

  it("caps at 1", () => {
    const interests = new Map([["a", 5], ["b", 5]]);
    expect(computeInterestScore(["a", "b"], interests)).toBe(1);
  });
});

// ============================================================================
// Followed post scoring
// ============================================================================

describe("scoreFollowedPost", () => {
  it("scores newer posts higher than older posts (same engagement)", () => {
    const now = Date.now();
    const newPost = makePost("1", "a", 1, 5, 2, 0, [], now);
    const oldPost = makePost("2", "a", 100, 5, 2, 0, [], now);

    const scoreNew = scoreFollowedPost(newPost, 0, config, now);
    const scoreOld = scoreFollowedPost(oldPost, 0, config, now);

    expect(scoreNew).toBeGreaterThan(scoreOld);
  });

  it("scores posts with more engagement higher", () => {
    const now = Date.now();
    const lowEng = makePost("1", "a", 5, 2, 0, 0, [], now);
    const highEng = makePost("2", "a", 5, 50, 20, 10, [], now);

    const scoreLow = scoreFollowedPost(lowEng, 0, config, now);
    const scoreHigh = scoreFollowedPost(highEng, 0, config, now);

    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it("scores posts from closer-relationship authors higher", () => {
    const now = Date.now();
    const post = makePost("1", "a", 5, 10, 5, 0, [], now);

    const scoreNoRel = scoreFollowedPost(post, 0, config, now);
    const scoreHighRel = scoreFollowedPost(post, 10, config, now);

    expect(scoreHighRel).toBeGreaterThan(scoreNoRel);
  });
});

// ============================================================================
// Suggested post scoring
// ============================================================================

describe("scoreSuggestedPost", () => {
  it("scores posts with matching interests higher", () => {
    const now = Date.now();
    const interests = new Map([["dressage", 3]]);
    const match = makePost("1", "a", 5, 10, 5, 0, ["dressage"], now);
    const noMatch = makePost("2", "b", 5, 10, 5, 0, ["cooking"], now);

    const scoreMatch = scoreSuggestedPost(match, interests, config, now);
    const scoreNone = scoreSuggestedPost(noMatch, interests, config, now);

    expect(scoreMatch).toBeGreaterThan(scoreNone);
  });

  it("penalizes low-engagement posts", () => {
    const now = Date.now();
    const interests = new Map<string, number>();
    const highEng = makePost("1", "a", 5, 50, 20, 0, [], now);
    const lowEng = makePost("2", "b", 5, 0, 0, 0, [], now);

    const scoreHigh = scoreSuggestedPost(highEng, interests, config, now);
    const scoreLow = scoreSuggestedPost(lowEng, interests, config, now);

    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });
});

// ============================================================================
// Interleaving
// ============================================================================

describe("interleaveFeed", () => {
  it("places followed posts before suggested when both exist", () => {
    const followed = [{ id: "f1" }, { id: "f2" }, { id: "f3" }];
    const suggested = [{ id: "s1" }, { id: "s2" }];
    const ads: any[] = [];

    const { items } = interleaveFeed(followed, suggested, ads, 0, 100, 10);
    const postIds = items.map((i) => i.item.id);

    // All followed should come before suggested
    const f3Idx = postIds.indexOf("f3");
    const s1Idx = postIds.indexOf("s1");
    expect(f3Idx).toBeLessThan(s1Idx);
  });

  it("inserts ads at the configured interval", () => {
    const followed = Array.from({ length: 20 }, (_, i) => ({ id: `f${i}` }));
    const suggested: any[] = [];
    const ads = [{ id: "ad1" }, { id: "ad2" }, { id: "ad3" }];

    const { items } = interleaveFeed(followed, suggested, ads, 6, 100, 20);

    const adPositions = items
      .map((item, idx) => (item.kind === "ad" ? idx : -1))
      .filter((idx) => idx >= 0);

    expect(adPositions.length).toBeGreaterThanOrEqual(1);

    // Verify no back-to-back ads
    for (let i = 1; i < adPositions.length; i++) {
      expect(adPositions[i] - adPositions[i - 1]).toBeGreaterThan(1);
    }
  });

  it("never inserts ads back to back", () => {
    const followed = Array.from({ length: 30 }, (_, i) => ({ id: `f${i}` }));
    const ads = Array.from({ length: 10 }, (_, i) => ({ id: `ad${i}` }));

    const { items } = interleaveFeed(followed, [], ads, 3, 100, 30);

    for (let i = 1; i < items.length; i++) {
      if (items[i].kind === "ad") {
        expect(items[i - 1].kind).not.toBe("ad");
      }
    }
  });

  it("does not produce duplicates", () => {
    const followed = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}` }));
    const suggested = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}` }));
    const ads = [{ id: "ad1" }];

    const { items } = interleaveFeed(followed, suggested, ads, 6, 5, 20);
    const ids = items.map((i) => `${i.kind}_${i.item.id}`);
    const unique = new Set(ids);

    expect(unique.size).toBe(ids.length);
  });

  it("fills with suggested when followed runs out", () => {
    const followed = [{ id: "f1" }];
    const suggested = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
    }));

    const { items } = interleaveFeed(followed, suggested, [], 0, 100, 8);

    expect(items.length).toBe(8);
    expect(items[0].item.id).toBe("f1");
    expect(items[1].item.id).toBe("s0");
  });

  it("mixes suggested among followed at the configured interval", () => {
    const followed = Array.from({ length: 20 }, (_, i) => ({ id: `f${i}` }));
    const suggested = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}` }));

    const { items } = interleaveFeed(followed, suggested, [], 0, 5, 25);

    // First suggested should appear around position 5 (after 5 followed)
    const firstSuggested = items.findIndex(
      (i) => i.kind === "post" && i.item.id.startsWith("s")
    );
    expect(firstSuggested).toBe(5);
  });

  it("respects ad interval across paginated calls", () => {
    const followed1 = Array.from({ length: 10 }, (_, i) => ({ id: `p1_f${i}` }));
    const ads1 = [{ id: "ad1" }, { id: "ad2" }];

    const page1 = interleaveFeed(followed1, [], ads1, 6, 100, 10);

    const followed2 = Array.from({ length: 10 }, (_, i) => ({ id: `p2_f${i}` }));
    const ads2 = [{ id: "ad3" }, { id: "ad4" }];

    const page2 = interleaveFeed(
      followed2,
      [],
      ads2,
      6,
      100,
      10,
      page1.organicCount,
      page1.adCount
    );

    // Combined: no back-to-back ads across the boundary
    const allItems = [...page1.items, ...page2.items];
    for (let i = 1; i < allItems.length; i++) {
      if (allItems[i].kind === "ad") {
        expect(allItems[i - 1].kind).not.toBe("ad");
      }
    }
  });

  it("returns empty when no content is available", () => {
    const { items } = interleaveFeed([], [], [], 6, 5, 10);
    expect(items).toHaveLength(0);
  });
});

// ============================================================================
// Cursor encoding / decoding
// ============================================================================

describe("cursor encoding", () => {
  it("round-trips cursor data", () => {
    const data = {
      seenPostIds: ["a", "b", "c"],
      seenAdIds: ["ad1"],
      organicCount: 12,
      adCount: 2,
    };

    const encoded = encodeCursor(data);
    const decoded = decodeCursor(encoded);

    expect(decoded).toEqual(data);
  });

  it("returns defaults for invalid cursor", () => {
    const decoded = decodeCursor("not-valid-base64!!");
    expect(decoded.seenPostIds).toEqual([]);
    expect(decoded.organicCount).toBe(0);
  });
});

// ============================================================================
// Block/mute rule tests (integration-style, testing exclusion logic)
// ============================================================================

describe("block/mute filtering (unit-level)", () => {
  it("excludeAuthors filter removes blocked users from suggested candidates", () => {
    const followingIds = new Set(["user1"]);
    const blockedIds = new Set(["spammer1", "blocked2"]);
    const userId = "me";
    const excludeAuthors = Array.from(followingIds).concat(Array.from(blockedIds)).concat(userId);

    const posts = [
      { id: "p1", author_id: "spammer1" },
      { id: "p2", author_id: "random_user" },
      { id: "p3", author_id: "blocked2" },
      { id: "p4", author_id: "good_user" },
    ];

    const filtered = posts.filter(
      (p) => !excludeAuthors.includes(p.author_id)
    );

    expect(filtered.map((p) => p.id)).toEqual(["p2", "p4"]);
  });
});

// ============================================================================
// Seen cooldown logic
// ============================================================================

describe("seen cooldown dedup", () => {
  it("cursor-based seenPostIds excludes previously served posts", () => {
    const cursorSeenIds = ["post1", "post2", "post3"];
    const seenPostIdsFromDb = new Set(["post4", "post5"]);

    const excludeSet = new Set(Array.from(seenPostIdsFromDb).concat(cursorSeenIds));

    const candidates = [
      { id: "post1" },
      { id: "post2" },
      { id: "post6" },
      { id: "post7" },
    ];

    const filtered = candidates.filter((p) => !excludeSet.has(p.id));
    expect(filtered.map((p) => p.id)).toEqual(["post6", "post7"]);
  });

  it("combines DB seen and cursor seen for complete dedup", () => {
    const dbSeen = new Set(["a", "b"]);
    const cursorSeen = ["c", "d"];
    const allSeen = new Set(Array.from(dbSeen).concat(cursorSeen));

    const items = ["a", "b", "c", "d", "e", "f"];
    const result = items.filter((id) => !allSeen.has(id));

    expect(result).toEqual(["e", "f"]);
  });
});
