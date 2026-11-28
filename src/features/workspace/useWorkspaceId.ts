import { useLocalSearchParams } from "expo-router";
import { createContext, useContext } from "react";

/**
 * The workspace of the enclosing `w/[workspaceId]` layout. Tab screens read it
 * from here: a tab press navigates without the parent's params, so their own
 * search params lack `workspaceId` and every query would stay disabled.
 */
export const WorkspaceIdContext = createContext<string | null>(null);

export function useWorkspaceId(): string {
  const fromLayout = useContext(WorkspaceIdContext);
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  return fromLayout ?? workspaceId ?? "";
}
