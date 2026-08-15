"use client";

import { useRouter } from "next/navigation";
import { StartDial } from "@/components/train/start-dial";
import {
  MIC_BLOCKED_HELP,
  requestMicAccess,
} from "@/lib/capture/mic-preflight";
import { useState } from "react";
import {
  RideModeChooser,
  hrefWithRideMode,
  type RideMode,
} from "@/components/train/ride-mode-chooser";

/** Home dial: invert + timer, mic warm, then solo vs trainer, then live. */
export function HomeStartDial({
  horseName,
  liveHref,
}: {
  horseName: string;
  liveHref: string;
}) {
  const router = useRouter();
  const [help, setHelp] = useState<string | null>(null);
  const [chooseMode, setChooseMode] = useState(false);
  const [navigating, setNavigating] = useState(false);

  function go(mode: RideMode) {
    setNavigating(true);
    router.push(hrefWithRideMode(liveHref, mode));
  }

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
          setChooseMode(true);
        }}
      />
      {help ? (
        <p className="mx-auto mt-3 max-w-xs text-center text-xs leading-relaxed text-watch">
          {help}
        </p>
      ) : null}
      {chooseMode ? (
        <div className="mt-6">
          <RideModeChooser onChoose={go} busy={navigating} />
        </div>
      ) : null}
    </div>
  );
}
