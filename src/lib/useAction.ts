import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api/client";
import { mapFieldErrors, problemMessage, type ProblemContext } from "./problems";

export interface ActionState {
  pending: boolean;
  /** Plain-language message for the whole form. */
  error: string | null;
  /** Messages by field name ("current_password"). */
  fields: Record<string, string>;
  slug: string | null;
  retryAfterSeconds: number | null;
}

export type ActionResult<T> =
  { ok: true; value: T } | { ok: false; slug: string | null; retryAfterSeconds: number | null };

const idle: ActionState = {
  pending: false,
  error: null,
  fields: {},
  slug: null,
  retryAfterSeconds: null,
};

/**
 * Runs one API call at a time and turns problem codes into messages.
 * Returns the result, or undefined on failure (the state holds the message).
 */
export function useAction<A extends unknown[], T>(
  fn: (...args: A) => Promise<T>,
  ctx: ProblemContext = "generic",
) {
  const [state, setState] = useState<ActionState>(idle);
  const busy = useRef(false);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const exec = useCallback(
    async (...args: A): Promise<ActionResult<T>> => {
      if (busy.current) return { ok: false, slug: null, retryAfterSeconds: null };
      busy.current = true;
      setState({ ...idle, pending: true });
      try {
        const out = await fnRef.current(...args);
        setState(idle);
        return { ok: true, value: out };
      } catch (e) {
        const problem =
          e instanceof ApiError
            ? e.problem
            : { type: "/problems/unavailable", status: 0, title: "" };
        const fields = mapFieldErrors(problem.errors ?? undefined);
        const hasFields = Object.keys(fields).length > 0;
        const slug = e instanceof ApiError ? e.slug : "unavailable";
        const retryAfterSeconds = problem.retry_after_seconds ?? null;
        setState({
          pending: false,
          error:
            hasFields && problem.type.endsWith("/invalid") ? null : problemMessage(problem, ctx),
          fields,
          slug,
          retryAfterSeconds,
        });
        return { ok: false, slug, retryAfterSeconds };
      } finally {
        busy.current = false;
      }
    },
    [ctx],
  );

  /** Resolves to the result, or undefined on failure (a 204 result is also undefined: use `exec`). */
  const run = useCallback(
    async (...args: A): Promise<T | undefined> => {
      const r = await exec(...args);
      return r.ok ? r.value : undefined;
    },
    [exec],
  );

  const reset = useCallback(() => setState(idle), []);
  return { ...state, run, exec, reset };
}
