import type { FlagStage, UserRole } from "@/types/database";

export interface FlagEvalContext {
  flagKey: string;
  userId: string;
  role: UserRole;
  isBetaTester: boolean;
  /** Explicit per-user override for this flag, if any. */
  override?: boolean;
  stage: FlagStage;
  rolloutPercentage: number;
}

/**
 * Deterministic 0-99 bucket for a (userId, flagKey) pair so a given user is
 * consistently in or out of a percentage rollout (no flicker between loads).
 * Simple FNV-1a hash — not cryptographic, just stable + well-distributed.
 */
export function rolloutBucket(userId: string, flagKey: string): number {
  const input = `${flagKey}:${userId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // >>> 0 to get an unsigned 32-bit int, then mod 100
  return (hash >>> 0) % 100;
}

/**
 * Evaluate a single flag for a viewer. Precedence:
 *   1. Explicit per-user override (allow or deny) always wins.
 *   2. Otherwise the stage ladder decides:
 *      off          → nobody
 *      internal     → admins only (team dogfooding)
 *      closed_beta  → admins + tagged beta testers
 *      open_beta    → admins + beta testers + users inside the rollout %
 *      ga           → everyone
 */
export function evaluateFlag(ctx: FlagEvalContext): boolean {
  if (ctx.override !== undefined) return ctx.override;

  const isAdmin = ctx.role === "admin";

  switch (ctx.stage) {
    case "off":
      return false;
    case "internal":
      return isAdmin;
    case "closed_beta":
      return isAdmin || ctx.isBetaTester;
    case "open_beta":
      return (
        isAdmin ||
        ctx.isBetaTester ||
        rolloutBucket(ctx.userId, ctx.flagKey) < ctx.rolloutPercentage
      );
    case "ga":
      return true;
    default:
      return false;
  }
}
