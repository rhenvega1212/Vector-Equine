import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLIC_APP_ORIGIN,
  isLanJoinOrigin,
  isLoopbackHost,
  isLoopbackOrigin,
  isPrivateLanHost,
  isPrivateLanOrigin,
  isPublicJoinOrigin,
  localTrainerJoinUrl,
  pickPublicJoinOrigin,
  publicTrainerJoinUrl,
  resolveTrainerJoinUrl,
} from "@/lib/capture/join-url";

describe("join-url", () => {
  it("rejects localhost, waitlist, and plain http as public trainer origins", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackOrigin("http://localhost:3000")).toBe(true);
    expect(isPrivateLanHost("192.168.1.20")).toBe(true);
    expect(isPrivateLanOrigin("http://192.168.1.20:3000")).toBe(true);
    expect(isLanJoinOrigin("http://192.168.1.20:3000")).toBe(true);
    expect(isPublicJoinOrigin("http://localhost:3000")).toBe(false);
    expect(isPublicJoinOrigin("http://192.168.1.20:3000")).toBe(false);
    expect(isPublicJoinOrigin("https://192.168.1.20")).toBe(false);
    expect(isPublicJoinOrigin("https://vectorequine.com")).toBe(false);
    expect(isPublicJoinOrigin("https://www.vectorequine.com")).toBe(false);
    expect(isPublicJoinOrigin(DEFAULT_PUBLIC_APP_ORIGIN)).toBe(true);
  });

  it("skips unreachable candidates and lands on the live app", () => {
    expect(
      pickPublicJoinOrigin(
        "http://localhost:3000",
        "http://192.168.1.20:3000",
        "https://vectorequine.com"
      )
    ).toBe(DEFAULT_PUBLIC_APP_ORIGIN);
    expect(pickPublicJoinOrigin("http://localhost:3000")).toBe(
      DEFAULT_PUBLIC_APP_ORIGIN
    );
  });

  it("never puts a LAN IP in the QR — iPhone blocks the mic on http", () => {
    expect(
      resolveTrainerJoinUrl({
        joinCode: "k7n2px",
        pageOrigin: "http://localhost:3000",
        serverJoinUrl: "https://vectorequine.com/join/K7N2PX",
        lanJoinUrl: "http://192.168.1.20:3000/join/K7N2PX",
      })
    ).toBe(`${DEFAULT_PUBLIC_APP_ORIGIN}/join/K7N2PX`);
  });

  it("falls back to the live app when there is no public origin", () => {
    expect(
      resolveTrainerJoinUrl({
        joinCode: "k7n2px",
        pageOrigin: "http://localhost:3000",
        serverJoinUrl: "https://vectorequine.com/join/K7N2PX",
      })
    ).toBe(`${DEFAULT_PUBLIC_APP_ORIGIN}/join/K7N2PX`);
  });

  it("uses the page origin when the rider is already on the live app", () => {
    expect(
      resolveTrainerJoinUrl({
        joinCode: "k7n2px",
        pageOrigin: "https://vector-equine.vercel.app",
        serverJoinUrl: "http://localhost:3000/join/K7N2PX",
        lanJoinUrl: "http://192.168.1.20:3000/join/K7N2PX",
      })
    ).toBe("https://vector-equine.vercel.app/join/K7N2PX");
  });

  it("keeps a public https join URL for the phone", () => {
    expect(
      publicTrainerJoinUrl({
        joinCode: "ab12cd",
        pageOrigin: "http://localhost:3000",
        serverJoinUrl: "https://vector-equine.vercel.app/join/AB12CD",
      })
    ).toBe("https://vector-equine.vercel.app/join/AB12CD");
  });

  it("exposes a same-machine join URL for lab tests", () => {
    expect(
      localTrainerJoinUrl({
        joinCode: "ax8ety",
        pageOrigin: "http://localhost:3000",
      })
    ).toBe("http://localhost:3000/join/AX8ETY");
    expect(
      localTrainerJoinUrl({
        joinCode: "ax8ety",
        pageOrigin: "http://192.168.1.20:3000",
      })
    ).toBeNull();
    expect(
      localTrainerJoinUrl({
        joinCode: "ax8ety",
        pageOrigin: "https://vector-equine.vercel.app",
      })
    ).toBeNull();
  });
});
