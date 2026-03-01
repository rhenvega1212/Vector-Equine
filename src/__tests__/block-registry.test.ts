import {
  getBlockMeta,
  getAllBlockMeta,
  getBlocksByCategory,
  getDefaultSettings,
} from "../lib/blocks/registry";
import { BLOCK_TYPES } from "../lib/blocks/types";

describe("getBlockMeta", () => {
  it.each(BLOCK_TYPES)("returns correct meta for block type '%s'", (type) => {
    const meta = getBlockMeta(type);
    expect(meta).toBeDefined();
    expect(meta.type).toBe(type);
    expect(typeof meta.label).toBe("string");
    expect(meta.label.length).toBeGreaterThan(0);
  });
});

describe("getAllBlockMeta", () => {
  it("returns all 12 block types", () => {
    const all = getAllBlockMeta();
    expect(all).toHaveLength(12);

    const types = all.map((m) => m.type);
    for (const bt of BLOCK_TYPES) {
      expect(types).toContain(bt);
    }
  });
});

describe("getBlocksByCategory", () => {
  it("filters content blocks", () => {
    const content = getBlocksByCategory("content");
    expect(content.length).toBeGreaterThan(0);
    expect(content.every((m) => m.category === "content")).toBe(true);
    expect(content.map((m) => m.type)).toContain("rich_text");
    expect(content.map((m) => m.type)).toContain("callout");
  });

  it("filters media blocks", () => {
    const media = getBlocksByCategory("media");
    expect(media.length).toBeGreaterThan(0);
    expect(media.every((m) => m.category === "media")).toBe(true);
    expect(media.map((m) => m.type)).toContain("image");
    expect(media.map((m) => m.type)).toContain("video");
  });

  it("filters interactive blocks", () => {
    const interactive = getBlocksByCategory("interactive");
    expect(interactive.length).toBeGreaterThan(0);
    expect(interactive.every((m) => m.category === "interactive")).toBe(true);
    expect(interactive.map((m) => m.type)).toContain("discussion");
    expect(interactive.map((m) => m.type)).toContain("quiz");
  });

  it("filters layout blocks", () => {
    const layout = getBlocksByCategory("layout");
    expect(layout.length).toBeGreaterThan(0);
    expect(layout.every((m) => m.category === "layout")).toBe(true);
    expect(layout.map((m) => m.type)).toContain("divider");
  });
});

describe("getDefaultSettings", () => {
  it.each(BLOCK_TYPES)(
    "returns non-null settings for block type '%s'",
    (type) => {
      const settings = getDefaultSettings(type);
      expect(settings).toBeDefined();
      expect(typeof settings).toBe("object");
      expect(settings).not.toBeNull();
    }
  );
});

describe("each block type has label and icon", () => {
  it.each(BLOCK_TYPES)("'%s' has a label and icon", (type) => {
    const meta = getBlockMeta(type);
    expect(meta.label).toBeTruthy();
    expect(meta.icon).toBeTruthy();
  });
});
