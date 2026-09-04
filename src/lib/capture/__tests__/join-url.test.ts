import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLIC_APP_ORIGIN,
  isLoopbackHost,
  isLoopbackOrigin,
  isPrivateLanHost,
  isPublicJoinOrigin,
  pickPublicJoinOrigin,
  resolveTrainerJoinUrl,
} from "@/lib/capture/join-url";

describe("join-url", () => {
  it("rejects localhost, LAN, and plain http as trainer QR origins", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackOrigin("http://localhost:3000")).toBe(true);
    expect(isPrivateLanHost("192.168.1.20")).toBe(true);
    expect(isPublicJoinOrigin("http://localhost:3000")).toBe(false);
    expect(isPublicJoinOrigin("http://192.168.1.20:3000")).toBe(false);
    expect(isPublicJoinOrigin("https://192.168.1.20")).toBe(false);
    expect(isPublicJoinOrigin("https://vectorequine.com")).toBe(true);
  });

  it("skips unreachable candidates and lands on the public site", () => {
    expect(
      pickPublicJoinOrigin(
        "http://localhost:3000",
        "http://192.168.1.20:3000",
        "https://vectorequine.com"
      )
    ).toBe("https://vectorequine.com");
    expect(pickPublicJoinOrigin("http://localhost:3000")).toBe(
      DEFAULT_PUBLIC_APP_ORIGIN
    );
  });

  it("encodes a public join URL when the rider is on localhost", () => {
    expect(
      resolveTrainerJoinUrl({
        joinCode: "k7n2px",
        pageOrigin: "http://localhost:3000",
        serverJoinUrl: "https://vectorequine.com/join/K7N2PX",
      })
    ).toBe("https://vectorequine.com/join/K7N2PX");
  });

  it("uses the page origin when the rider is already on https", () => {
    expect(
      resolveTrainerJoinUrl({
        joinCode: "k7n2px",
        pageOrigin: "https://vectorequine.com",
        serverJoinUrl: "http://localhost:3000/join/K7N2PX",
      })
    ).toBe("https://vectorequine.com/join/K7N2PX");
  });

  it("never puts a LAN IP in the QR", () => {
    expect(
      resolveTrainerJoinUrl({
        joinCode: "ab12cd",
        pageOrigin: "http://localhost:3000",
        serverJoinUrl: "http://10.0.0.4:3000/join/AB12CD",
      })
    ).toBe("https://vectorequine.com/join/AB12CD");
  });
});
