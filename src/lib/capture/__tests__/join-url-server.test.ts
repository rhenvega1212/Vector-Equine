import { describe, expect, it } from "vitest";
import {
  joinOriginFromRequest,
  lanHttpOrigin,
} from "@/lib/capture/join-url-server";
import { DEFAULT_PUBLIC_APP_ORIGIN } from "@/lib/capture/join-url";
import type { NetworkInterfaceInfo } from "os";

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

  it("skips the waitlist host even if APP_URL points there", () => {
    const prevJoin = process.env.NEXT_PUBLIC_JOIN_ORIGIN;
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_JOIN_ORIGIN;
    process.env.NEXT_PUBLIC_APP_URL = "https://vectorequine.com";
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

  it("picks the Mac Wi-Fi IPv4 for a same-LAN join origin", () => {
    const fake: NodeJS.Dict<NetworkInterfaceInfo[]> = {
      lo0: [
        {
          address: "127.0.0.1",
          netmask: "255.0.0.0",
          family: "IPv4",
          mac: "00:00:00:00:00:00",
          internal: true,
          cidr: "127.0.0.1/8",
        },
      ],
      en0: [
        {
          address: "192.168.1.20",
          netmask: "255.255.255.0",
          family: "IPv4",
          mac: "aa:bb:cc:dd:ee:ff",
          internal: false,
          cidr: "192.168.1.20/24",
        },
      ],
    };
    expect(lanHttpOrigin(3000, fake)).toBe("http://192.168.1.20:3000");
  });
});
