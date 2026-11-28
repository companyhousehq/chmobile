import { useRouter, type Href } from "expo-router";
import { useWorkspaceId } from "./useWorkspaceId";
import { useRefreshWorkspace, useWorkspace, useWsContext, wsApi } from "@/lib/api/workspaces";
import { useAction } from "@/lib/useAction";
import {
  entityTypeLabel,
  legalProfileLabel,
  showRoles,
  verificationMeta,
  workspaceTypeLabel,
} from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { confirm } from "@/ui/confirm";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.ws.workspace;

/** Workspace tab: profile summary, profile/roles entries, switch and leave (M7, M9). */
export function WorkspaceTab() {
  const id = useWorkspaceId();
  const router = useRouter();
  const workspace = useWorkspace(id);
  const ctx = useWsContext(id);
  const refresh = useRefreshWorkspace(id);
  const leave = useAction(async () => {
    await wsApi.leave(id);
    await refresh();
  }, "leave");
  const perms = ctx.data?.permissions ?? [];
  const w = workspace.data;
  const v = verificationMeta(w?.verification_status ?? "");
  const line = (label: string, value: string | null | undefined) => (
    <Text variant="footnote" tone="text2">
      {label}: {value || t.none}
    </Text>
  );

  return (
    <Screen edges={["bottom"]}>
      <Text variant="title2" bold accessibilityRole="header">
        {t.title}
      </Text>
      <QueryGate queries={[workspace, ctx]}>
        {w ? (
          <>
            <Card>
              <Text bold>{w.display_name}</Text>
              <Badge label={v.label} tone={v.tone} />
              <Text variant="footnote" tone="textMuted">
                {t.verifiedHelper}
              </Text>
              {line(t.type, workspaceTypeLabel(w.type))}
              {line(t.legal, legalProfileLabel(w.legal_profile_type))}
              {w.registration
                ? line(
                    t.registration,
                    `${entityTypeLabel(w.registration.entity_type)} ${w.registration.identifier}`,
                  )
                : null}
              {line(t.contact, [w.contact.email, w.contact.phone].filter(Boolean).join(" · "))}
              {line(
                t.address,
                [w.address.line1, w.address.line2, w.address.city, w.address.state]
                  .filter(Boolean)
                  .join(", "),
              )}
            </Card>
            <Row
              title={t.profile}
              hint={t.profileHint}
              onPress={() => router.push(`/w/${id}/profile` as Href)}
            />
            {showRoles(w.type, perms) ? (
              <Row
                title={t.roles}
                hint={t.rolesHint}
                onPress={() => router.push(`/w/${id}/roles` as Href)}
              />
            ) : null}
            <Row title={t.switch} onPress={() => router.push("/switch")} />
            <Row title={t.mine} onPress={() => router.push("/workspaces")} />
            {leave.error ? <Notice tone="danger">{leave.error}</Notice> : null}
            {w.type === "agency" ? (
              <Button
                label={t.leave}
                variant="secondary"
                destructive
                busy={leave.pending}
                onPress={async () => {
                  if (
                    await confirm(
                      strings.ws.team.leave,
                      strings.ws.team.confirmLeave,
                      strings.ws.team.leave,
                    )
                  ) {
                    const res = await leave.exec();
                    if (res.ok) router.replace("/");
                  }
                }}
              />
            ) : null}
          </>
        ) : null}
      </QueryGate>
    </Screen>
  );
}
