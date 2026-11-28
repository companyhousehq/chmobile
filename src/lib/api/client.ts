import { problemSlug } from "../problems";
import type { PageResponse, Problem } from "../types";

/**
 * Fetch wrapper for the Company House API (design 4.1, 4.3, 5).
 *
 * - Sends X-Client-Platform, X-App-Version and User-Agent on every request.
 * - Parses problem+json into ApiError. Bodies and headers are never logged.
 * - Any 401 on a request that carried a token runs `onUnauthenticated`
 *   (the sign-out wipe), then still throws so callers stop.
 * - Any 426 runs `onUpdateRequired` (the blocking update screen).
 * No platform imports: the runtime wiring lives in ./runtime.ts.
 */

export type ClientPlatform = "ios" | "android";

export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.title || problem.type);
    this.name = "ApiError";
    this.status = problem.status;
    this.problem = problem;
  }

  get slug(): string {
    return problemSlug(this.problem.type);
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  platform: ClientPlatform;
  /** Store version, MAJOR.MINOR.PATCH. */
  appVersion: string;
  buildNumber: string;
  osVersion: string;
  getToken: () => string | null;
  onUnauthenticated?: () => void | Promise<void>;
  /** 426 app-update-required, or 400 client-identification-required. */
  onUpdateRequired?: (problem: Problem) => void;
  /** 403 factor-required or consent-required: the session needs a step before it is usable. */
  onGateRequired?: (slug: "factor-required" | "consent-required") => void;
  /** Any 404, with the request path (never the body): lets the app notice a lost company or workspace. */
  onNotFound?: (path: string) => void;
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  /** Send no Authorization header even when signed in (sign-in, sign-up). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  getAll<T>(path: string, maxItems?: number): Promise<T[]>;
  /** Aborts every in-flight request (sign-out wipe step 1). */
  abortAll(): void;
}

const UNAVAILABLE: Problem = {
  type: "/problems/unavailable",
  title: "Unavailable",
  status: 0,
};

function userAgent(o: ApiClientOptions): string {
  return `CompanyHouse/${o.appVersion} (${o.platform} ${o.osVersion}; build ${o.buildNumber})`;
}

async function readProblem(res: Response): Promise<Problem> {
  const fallback: Problem = {
    type: `/problems/${res.status >= 500 ? "unavailable" : "unknown"}`,
    title: res.statusText || "Request failed",
    status: res.status,
  };
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return fallback;
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && typeof (body as Problem).type === "string") {
      return { ...fallback, ...(body as Problem), status: res.status };
    }
  } catch {
    // Not valid JSON: use the fallback.
  }
  return fallback;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetchImpl ?? fetch;
  const inflight = new Set<AbortController>();

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(path, `${options.baseUrl}/`);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const token = opts.anonymous ? null : options.getToken();
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Client-Platform": options.platform,
      "X-App-Version": options.appVersion,
      "User-Agent": userAgent(options),
      ...opts.headers,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    // Multipart bodies set their own Content-Type (with the boundary).
    const multipart = typeof FormData !== "undefined" && opts.body instanceof FormData;
    if (opts.body !== undefined && !multipart) headers["Content-Type"] = "application/json";

    const controller = new AbortController();
    inflight.add(controller);
    opts.signal?.addEventListener("abort", () => controller.abort());

    let res: Response;
    try {
      res = await doFetch(url.toString(), {
        method: opts.method ?? "GET",
        headers,
        body:
          opts.body === undefined
            ? undefined
            : multipart
              ? (opts.body as FormData)
              : JSON.stringify(opts.body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(UNAVAILABLE);
    } finally {
      inflight.delete(controller);
    }

    if (res.ok) {
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }

    const problem = await readProblem(res);
    const slug = problemSlug(problem.type);
    if (res.status === 426 || slug === "client-identification-required") {
      options.onUpdateRequired?.(problem);
    }
    if (
      res.status === 403 &&
      token &&
      (slug === "factor-required" || slug === "consent-required")
    ) {
      options.onGateRequired?.(slug);
    }
    if (res.status === 404) options.onNotFound?.(url.pathname);
    if (res.status === 401 && token) await options.onUnauthenticated?.();
    throw new ApiError(problem);
  }

  async function getAll<T>(path: string, maxItems = 5000): Promise<T[]> {
    const out: T[] = [];
    let cursor: string | null | undefined;
    do {
      const page = await request<PageResponse<T>>(path, {
        query: { limit: 100, cursor: cursor ?? undefined },
      });
      out.push(...(page.items ?? []));
      cursor = page.next_cursor;
      if (cursor && out.length >= maxItems) throw new ApiError(UNAVAILABLE);
    } while (cursor);
    return out;
  }

  return {
    request,
    getAll,
    abortAll() {
      for (const c of inflight) c.abort();
      inflight.clear();
    },
  };
}
