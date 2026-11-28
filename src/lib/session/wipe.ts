/**
 * Sign-out wipe (design 9.3), run on explicit sign-out, any 401, account
 * closure and five failed unlocks. Every step runs even if an earlier one
 * fails, so a partial failure never leaves the session or cached data behind.
 * The MMKV encryption key is kept on purpose (the next user gets fresh stores).
 */

export interface WipeSteps {
  /** 0. Drop the in-memory token synchronously, before anything awaits. */
  clearMemoryToken: () => void;
  /** 1. Cancel in-flight requests and uploads. */
  cancelRequests: () => void | Promise<void>;
  /** 2a. Clear the React Query cache. */
  clearQueryCache: () => void | Promise<void>;
  /** 2b. Clear the cache, drafts and app MMKV instances. */
  clearStorage: () => void | Promise<void>;
  /** 3. Delete cache/docs, document/drafts and document/uploads. */
  deleteFiles: () => void | Promise<void>;
  /** 4. Delete session_token and pending_link_token.* from the secure store. */
  clearSecrets: () => void | Promise<void>;
  /** 5. Sentry.setUser(null). */
  clearCrashUser: () => void | Promise<void>;
  /** 6. Route to sign-in. */
  routeToSignIn: () => void | Promise<void>;
}

export async function signOutWipe(steps: WipeSteps): Promise<{ failed: string[] }> {
  const order: (keyof WipeSteps)[] = [
    "clearMemoryToken",
    "cancelRequests",
    "clearQueryCache",
    "clearStorage",
    "deleteFiles",
    "clearSecrets",
    "clearCrashUser",
    "routeToSignIn",
  ];
  const failed: string[] = [];
  for (const name of order) {
    try {
      await steps[name]();
    } catch {
      failed.push(name);
    }
  }
  return { failed };
}
