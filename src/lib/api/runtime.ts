import * as Application from "expo-application";
import { Platform } from "react-native";
import { apiBaseUrl } from "../env";
import { currentToken } from "../auth/tokenStore";
import { Sentry } from "../sentry";
import { emitNotFound } from "./notFound";
import { createApiClient, type ApiClient, type ClientPlatform } from "./client";

/**
 * The app's API client, wired to the platform (base URL from
 * EXPO_PUBLIC_API_URL, identity headers from the native app). Handlers for
 * 401 and 426 are attached once by the session provider via `setApiHandlers`.
 */

type Handlers = Pick<
  Parameters<typeof createApiClient>[0],
  "onUnauthenticated" | "onUpdateRequired" | "onGateRequired"
>;

let handlers: Handlers = {};

export function setApiHandlers(next: Handlers): void {
  handlers = next;
}

export function semver(version: string | null): string {
  if (version && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version)) return version;
  const raw = version ?? "";
  if (__DEV__) throw new Error(`Invalid native app version "${raw}"; expected x.y.z.`);
  // Release: let the API decide on the raw value, and tell us about the bad build.
  Sentry.captureMessage("Invalid native app version", { extra: { version: raw } });
  return raw;
}

export const api: ApiClient = createApiClient({
  baseUrl: apiBaseUrl(),
  platform: (Platform.OS === "ios" ? "ios" : "android") satisfies ClientPlatform,
  appVersion: semver(Application.nativeApplicationVersion),
  buildNumber: Application.nativeBuildVersion ?? "0",
  osVersion: String(Platform.Version),
  getToken: currentToken,
  onUnauthenticated: () => handlers.onUnauthenticated?.(),
  onUpdateRequired: (problem) => handlers.onUpdateRequired?.(problem),
  onGateRequired: (slug) => handlers.onGateRequired?.(slug),
  onNotFound: emitNotFound,
});
