/**
 * Device lock policy (spec 0011 R12, design 4.6). A UI gate only: it never
 * replaces the server session or MFA. Pure so it can be unit-tested.
 */

export const LOCK_GRACE_MS = 5 * 60 * 1000;
export const MAX_UNLOCK_FAILURES = 5;

/** Cold start always locks when the lock is on. */
export function shouldLockOnLaunch(enabled: boolean): boolean {
  return enabled;
}

/** Locks after more than five minutes in the background. */
export function shouldLockOnResume(args: {
  enabled: boolean;
  backgroundedAt: number | null;
  now: number;
  graceMs?: number;
}): boolean {
  if (!args.enabled || args.backgroundedAt === null) return false;
  return args.now - args.backgroundedAt >= (args.graceMs ?? LOCK_GRACE_MS);
}

/** Counts a failed unlock; the fifth signs the user out with the full wipe. */
export function recordUnlockFailure(failures: number): { failures: number; signOut: boolean } {
  const next = failures + 1;
  return { failures: next, signOut: next >= MAX_UNLOCK_FAILURES };
}
