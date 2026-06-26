"use client";

import { createContext, useContext } from "react";
import {
  allFlagsOff,
  type EvaluatedFlags,
  type FeatureFlagKey,
} from "./registry";

const FeatureFlagsContext = createContext<EvaluatedFlags>(allFlagsOff());

/**
 * Provides server-evaluated feature flags to client components. Mount it high in
 * the tree (the main layout) with the flags computed on the server, so the
 * client never re-derives them or leaks gating logic.
 */
export function FeatureFlagsProvider({
  flags,
  children,
}: {
  flags: EvaluatedFlags;
  children: React.ReactNode;
}) {
  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/** All evaluated flags for the current viewer. */
export function useFeatureFlags(): EvaluatedFlags {
  return useContext(FeatureFlagsContext);
}

/** Whether a single flag is enabled for the current viewer. */
export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  return useContext(FeatureFlagsContext)[flag];
}
