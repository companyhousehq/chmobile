import { useRouter, type Href } from "expo-router";
import { PendingInvitations } from "@/features/workspace/PendingInvitations";
import { useContextLists, useMe } from "@/lib/api/queries";
import { verificationMeta, workspaceTypeLabel } from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { QueryGate } from "@/ui/QueryGate";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.ws.mine;

/** You > My workspaces and pending invitations (M7). */
export default function MyWorkspaces() {
  const router = useRouter();
  const me = useMe();
  const lists = useContextLists(me.data?.id);
  const items = lists.data?.workspaces ?? [];
  return (
    <Screen edges={["bottom"]}>
      <PendingInvitations />
      <Text variant="footnote" tone="textMuted" bold accessibilityRole="header">
        {t.workspaces}
      </Text>
      <QueryGate queries={[lists]}>
        {items.length === 0 ? <Text tone="textMuted">{t.empty}</Text> : null}
        {items.map((w) => {
          const v = verificationMeta(w.workspace.verification_status ?? "");
          return (
            <Row
              key={w.workspace.id}
              title={w.workspace.display_name}
              hint={`${workspaceTypeLabel(w.workspace.type)} · ${w.membership.role.name}`}
              right={<Badge label={v.label} tone={v.tone} />}
              onPress={() => router.replace(`/w/${w.workspace.id}` as Href)}
            />
          );
        })}
      </QueryGate>
      <Button label={t.create} onPress={() => router.push("/workspaces/new")} />
    </Screen>
  );
}
