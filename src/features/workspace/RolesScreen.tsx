import { Stack, useRouter, type Href } from "expo-router";
import { useWorkspaceId } from "./useWorkspaceId";
import { PermissionList } from "./PermissionList";
import { usePermissionCatalogue, useRoles, useWorkspace, useWsContext } from "@/lib/api/workspaces";
import {
  MAX_CUSTOM_ROLES,
  PERM,
  buildPicker,
  can,
  customRoleCount,
  describeRole,
  permissionSummary,
  showRoles,
} from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.ws.roles;

/** Roles list: starter and custom roles with counts (M15). No section for personal workspaces. */
export function RolesScreen() {
  const id = useWorkspaceId();
  const router = useRouter();
  const workspace = useWorkspace(id);
  const ctx = useWsContext(id);
  const perms = ctx.data?.permissions ?? [];
  const visible = !!workspace.data && showRoles(workspace.data.type, perms);
  const roles = useRoles(id, visible);
  const manage = can(perms, PERM.rolesManage);
  const list = roles.data ?? [];
  const n = customRoleCount(list);

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.title }} />
      <QueryGate queries={[workspace, ctx, ...(visible ? [roles] : [])]}>
        {workspace.data && workspace.data.type !== "agency" ? (
          <Notice>{t.notPersonal}</Notice>
        ) : null}
        {workspace.data?.type === "agency" && !visible ? <Notice>{t.noAccess}</Notice> : null}
        {visible ? (
          <>
            <Text tone="text2">{t.count(n)}</Text>
            {manage ? (
              <Button
                label={t.create}
                disabled={n >= MAX_CUSTOM_ROLES}
                onPress={() => router.push(`/w/${id}/roles/form` as Href)}
              />
            ) : null}
            {list.map((r) => (
              <Row
                key={r.id}
                title={r.name}
                hint={`${describeRole(r)} ${permissionSummary(r)} · ${t.members(r.member_count ?? 0)}${
                  r.pending_invitation_count ? ` · ${t.pending(r.pending_invitation_count)}` : ""
                }`}
                right={<Badge label={r.builtin ? t.starter : t.custom} />}
                onPress={() => router.push(`/w/${id}/roles/${r.id}` as Href)}
              />
            ))}
            <Row
              title={t.catalogue}
              onPress={() => router.push(`/w/${id}/roles/catalogue` as Href)}
            />
          </>
        ) : null}
      </QueryGate>
    </Screen>
  );
}

/** The live permissions catalogue, grouped by category. */
export function CatalogueScreen() {
  const id = useWorkspaceId();
  const catalogue = usePermissionCatalogue(id);
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.catalogue }} />
      <QueryGate queries={[catalogue]}>
        <PermissionList groups={buildPicker(catalogue.data ?? [], [])} />
      </QueryGate>
    </Screen>
  );
}
