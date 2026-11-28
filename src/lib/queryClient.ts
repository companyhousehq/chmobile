import NetInfo from "@react-native-community/netinfo";
import { onlineManager, QueryClient } from "@tanstack/react-query";

/**
 * React Query setup (design 1, 9.1). Reads retry and pause offline; mutations
 * use networkMode "online" and are never persisted, so a write is applied only
 * after the server confirms it. Query keys start with the user id.
 */
/** Never retry a 4xx (the answer won't change); retry network errors and 5xx twice. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "number" && status >= 400 && status <= 499) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryQuery, staleTime: 30_000, gcTime: 24 * 60 * 60 * 1000 },
      mutations: { networkMode: "online", retry: false },
    },
  });
}

/** Keeps React Query's notion of online in step with the device. */
export function wireOnlineManager(): () => void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );
  return () => onlineManager.setEventListener(() => () => {});
}
