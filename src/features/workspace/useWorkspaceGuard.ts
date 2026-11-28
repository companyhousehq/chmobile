import { useWsContext } from "@/lib/api/workspaces";
import { useLossGuard } from "@/lib/context/useLossGuard";
import { strings } from "@/strings";

/**
 * An agent removed from (or suspended in) a workspace gets 404 under it
 * (spec 0012 AC36). The workspace is dropped from the cached context lists and
 * its queries, and the app moves on to the next context.
 */
export function useWorkspaceGuard(workspaceId: string): void {
  const ctx = useWsContext(workspaceId);
  useLossGuard({ kind: "workspace", id: workspaceId }, ctx, strings.ws.lost);
}
