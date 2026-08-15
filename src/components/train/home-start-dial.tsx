"use client";

import { useRouter } from "next/navigation";
import { StartDial } from "@/components/train/start-dial";
import {
  MIC_BLOCKED_HELP,
  requestMicAccess,
} from "@/lib/capture/mic-preflight";
import { useState } from "react";

/** Home dial: invert + timer, then mic warm and navigate to live ride. */
export function HomeStartDial({
  horseName,
  liveHref,
}: {
  horseName: string;
  liveHref: string;
}) {
  const router = useRouter();
  const [help, setHelp] = useState<string | null>(null);

  return (
    <div>
      <StartDial
        horseName={horseName}
        onStart={async () => {
          setHelp(null);
          const result = await requestMicAccess();
          if (!result.ok && result.blocked) {
            setHelp(result.message || MIC_BLOCKED_HELP);
            return;
          }
          router.push(liveHref);
        }}
      />
      {help ? (
        <p className="mx-auto mt-3 max-w-xs text-center text-xs leading-relaxed text-watch">
          {help}
        </p>
      ) : null}
    </div>
  );
}
