import { useWorkspaceId } from "@/features/workspace/useWorkspaceId";
import { useWsContext } from "@/lib/api/workspaces";
import { hiddenWorkspaceTabs } from "@/lib/tabs";
import { strings } from "@/strings";
import { ContextTabs } from "@/ui/ContextTabs";

/** Agent context tabs (spec 0012 Navigation). */
export default function WorkspaceTabs() {
  const workspaceId = useWorkspaceId();
  const ctx = useWsContext(workspaceId);
  const hidden = hiddenWorkspaceTabs(ctx.data?.permissions);
  return (
    <ContextTabs
      context={{ kind: "workspace", id: workspaceId }}
      tabs={[
        { name: "index", title: strings.tabs.home, icon: "home-outline" },
        {
          name: "clients",
          hidden: hidden.has("clients"),
          title: strings.tabs.clients,
          icon: "briefcase-outline",
        },
        {
          name: "team",
          hidden: hidden.has("team"),
          title: strings.tabs.team,
          icon: "people-outline",
        },
        {
          name: "workspace",
          hidden: hidden.has("workspace"),
          title: strings.tabs.workspace,
          icon: "business-outline",
        },
        { name: "you", title: strings.tabs.you, icon: "person-circle-outline" },
      ]}
    />
  );
}
