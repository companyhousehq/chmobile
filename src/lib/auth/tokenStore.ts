import * as SecureStore from "expo-secure-store";

/**
 * Session token storage (design 4.4, spec 0011 R11). The token lives only in
 * the platform secure store and in this module's memory. It is never written
 * to MMKV, logs, the React Query cache or Sentry, and is excluded from
 * backups (WHEN_UNLOCKED_THIS_DEVICE_ONLY).
 */

const TOKEN_KEY = "session_token";
// SecureStore keys may contain only letters, digits, ".", "-" and "_".
const PENDING_LINK_PREFIX = "pending_link_token.";
/** Link kinds whose tokens may be parked while the user signs in (spec 0011 R14). */
export const PENDING_LINK_KINDS = ["invitation", "claim", "authorization", "email"] as const;

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let memoryToken: string | null = null;

/** Token for the API client; null when signed out or not yet loaded. */
export function currentToken(): string | null {
  return memoryToken;
}

/** Loads the stored token into memory at launch. */
export async function loadToken(): Promise<string | null> {
  memoryToken = (await SecureStore.getItemAsync(TOKEN_KEY, options)) ?? null;
  return memoryToken;
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, options);
  memoryToken = token;
}

/** Synchronous first step of the wipe: no request can pick up the old token after this. */
export function clearMemoryToken(): void {
  memoryToken = null;
}

export async function clearToken(): Promise<void> {
  memoryToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY, options);
}

export async function clearPendingLinkTokens(): Promise<void> {
  await Promise.all(
    PENDING_LINK_KINDS.map((kind) =>
      SecureStore.deleteItemAsync(`${PENDING_LINK_PREFIX}${kind}`, options),
    ),
  );
}

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type LinkKind = (typeof PENDING_LINK_KINDS)[number];

/**
 * Parks a link token in the secure store (design 7). Synchronous because it
 * runs inside the router's link redirect. The route is kept with the token so
 * a screen only consumes the token meant for it.
 */
export function stashLinkToken(kind: LinkKind, route: string, token: string, now = Date.now()) {
  SecureStore.setItem(
    `${PENDING_LINK_PREFIX}${kind}`,
    JSON.stringify({ route, token, exp: now + LINK_TTL_MS }),
    options,
  );
}

/** Reads a parked token for a route without removing it; expired or other-route tokens are dropped. */
export function peekLinkToken(kind: LinkKind, route: string, now = Date.now()): string | null {
  const raw = SecureStore.getItem(`${PENDING_LINK_PREFIX}${kind}`, options);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { route?: string; token?: string; exp?: number };
    if (typeof v.exp !== "number" || v.exp < now) {
      void dropLinkToken(kind);
      return null;
    }
    return v.route === route && typeof v.token === "string" ? v.token : null;
  } catch {
    return null;
  }
}

export async function dropLinkToken(kind: LinkKind): Promise<void> {
  await SecureStore.deleteItemAsync(`${PENDING_LINK_PREFIX}${kind}`, options);
}
