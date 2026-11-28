/** Build-time configuration. Only non-secret values belong in EXPO_PUBLIC_* variables. */

import { Platform } from "react-native";

export const DEFAULT_API_URL = "http://localhost:8080";
export const ANDROID_EMULATOR_API_URL = "http://10.0.2.2:8080";

export function apiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (raw && raw.length > 0) return raw.replace(/\/+$/, "");
  if (!__DEV__) {
    throw new Error("EXPO_PUBLIC_API_URL is not set; a release build needs the API URL.");
  }
  return Platform.OS === "android" ? ANDROID_EMULATOR_API_URL : DEFAULT_API_URL;
}

export function sentryDsn(): string | undefined {
  const raw = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export const DEFAULT_WEB_URL = "https://www.companyhouse.ng";

/** Website origin, for the Terms and Privacy pages the in-app browser opens (OQ-7). */
export function webBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_WEB_URL).replace(/\/+$/, "");
}
