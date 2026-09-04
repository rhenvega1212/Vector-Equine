import { describe, expect, it } from "vitest";
import { joinOriginFromRequest } from "@/lib/capture/join-url-server";
import { DEFAULT_PUBLIC_APP_ORIGIN } from "@/lib/capture/join-url";

function headers(map: Record<string, string>) {
  return {
    get(name: string) {
      return map[name] ?? map[name.toLowerCase()] ?? null;
    },
  };
}

describe("join-url-server", () => {
  it("does not encode localhost when the rider is on the local server", () => {
    const prevJoin = process.env.NEXT_PUBLIC_JOIN_ORIGIN;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_JOIN_ORIGIN;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    try {
      expect(
        joinOriginFromRequest({
          headers: headers({
            origin: "http://localhost:3000",
            host: "localhost:3000",
          }),
        })
      ).toBe(DEFAULT_PUBLIC_APP_ORIGIN);
    } finally {
      if (prevJoin === undefined) delete process.env.NEXT_PUBLIC_JOIN_ORIGIN;
      else process.env.NEXT_PUBLIC_JOIN_ORIGIN = prevJoin;
      if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevApp;
    }
  });

  it("keeps a public https request origin (preview or production)", () => {
    expect(
      joinOriginFromRequest({
        headers: headers({
          origin: "https://vector-equine-git-foo.vercel.app",
          host: "vector-equine-git-foo.vercel.app",
        }),
      })
    ).toBe("https://vector-equine-git-foo.vercel.app");
  });
});
