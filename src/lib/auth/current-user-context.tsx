"use client";

import { createContext, useContext } from "react";

/**
 * Whether the current viewer can moderate content (delete others' posts, etc).
 * True for admins, and for admins currently impersonating a rider (so the team
 * keeps moderation powers while "viewing as" someone).
 */
const CanModerateContext = createContext(false);

export function CurrentUserProvider({
  canModerate,
  children,
}: {
  canModerate: boolean;
  children: React.ReactNode;
}) {
  return (
    <CanModerateContext.Provider value={canModerate}>
      {children}
    </CanModerateContext.Provider>
  );
}

export function useCanModerate(): boolean {
  return useContext(CanModerateContext);
}
