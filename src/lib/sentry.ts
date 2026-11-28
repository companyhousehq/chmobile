import * as Sentry from "@sentry/react-native";
import { sentryDsn } from "./env";
import { scrubEvent, scrubBreadcrumb } from "./scrub";

/**
 * Crash reporting (ADR 0028, design 10.1). Wired but disabled without a DSN.
 * No user, no PII, no tracing, no replay, no attachments; events are scrubbed.
 */
export function initSentry(): boolean {
  const dsn = sentryDsn();
  if (!dsn) return false;
  Sentry.init({
    dsn,
    enabled: true,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  });
  return true;
}

export function clearCrashUser(): void {
  if (sentryDsn()) Sentry.setUser(null);
}

export { Sentry };
