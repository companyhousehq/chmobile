import { useEffect } from "react";
import { store } from "../storage/mmkv";
import { useMe } from "../api/queries";
import { lastContextKey, serializeContext, type ActingContext } from "./startingContext";

/** Remembers the context last used on this device, per user (AC3: reopen where you left off). */
export function useRememberContext(ctx: ActingContext): void {
  const { data: me } = useMe();
  const userId = me?.id;
  useEffect(() => {
    if (userId) store("app").set(lastContextKey(userId), serializeContext(ctx));
  }, [userId, ctx.kind, ctx.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
