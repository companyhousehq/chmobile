import type { QueryClient } from "@tanstack/react-query";
import { withoutContext, type ActingContext, type ContextLists } from "./startingContext";

/**
 * Forgets a company or workspace the user lost: out of the cached context
 * lists (so the starting-context resolver cannot bounce back to it) and its
 * cached queries. The lists are then refetched in the background.
 */
export function dropContextFromCache(qc: QueryClient, userId: string, ctx: ActingContext): void {
  const listKey = ["u", userId, "contexts"];
  qc.setQueryData<ContextLists | undefined>(listKey, (old) =>
    old ? withoutContext(old, ctx) : old,
  );
  qc.removeQueries({ queryKey: ["u", userId, ctx.kind === "company" ? "co" : "ws", ctx.id] });
  void qc.invalidateQueries({ queryKey: listKey });
}
