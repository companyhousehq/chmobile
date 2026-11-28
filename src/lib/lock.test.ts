import { LOCK_GRACE_MS, recordUnlockFailure, shouldLockOnLaunch, shouldLockOnResume } from "./lock";

describe("device lock policy (R12)", () => {
  it("locks on cold start only when enabled", () => {
    expect(shouldLockOnLaunch(true)).toBe(true);
    expect(shouldLockOnLaunch(false)).toBe(false);
  });

  it("locks after five minutes in the background, not before", () => {
    const base = { enabled: true, backgroundedAt: 1_000 };
    expect(shouldLockOnResume({ ...base, now: 1_000 + LOCK_GRACE_MS - 1 })).toBe(false);
    expect(shouldLockOnResume({ ...base, now: 1_000 + LOCK_GRACE_MS })).toBe(true);
  });

  it("never locks when disabled or never backgrounded", () => {
    expect(shouldLockOnResume({ enabled: false, backgroundedAt: 0, now: 10 ** 9 })).toBe(false);
    expect(shouldLockOnResume({ enabled: true, backgroundedAt: null, now: 10 ** 9 })).toBe(false);
  });

  it("signs out on the fifth failure", () => {
    let failures = 0;
    const outcomes: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      const r = recordUnlockFailure(failures);
      failures = r.failures;
      outcomes.push(r.signOut);
    }
    expect(outcomes).toEqual([false, false, false, false, true]);
  });
});
