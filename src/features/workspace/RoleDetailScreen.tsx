import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useWorkspaceId } from "./useWorkspaceId";
import { PermissionList } from "./PermissionList";
import {
  usePermissionCatalogue,
  useRefreshWorkspace,
  useRoles,
  useWsContext,
  wsApi,
} from "@/lib/api/workspaces";
import { useAction } from "@/lib/useAction";
import {
  PERM,
  buildPicker,
  can,
  canManageCustomRole,
  describeRole,
  roleInUse,
} from "@/lib/workspace";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { confirm } from "@/ui/confirm";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.ws.roles;

/** Role detail with its permissions; edit, duplicate and archive only where allowed. */
export function RoleDetailScreen() {
  const id = useWorkspaceId();
  const { roleId } = useLocalSearchParams<{ roleId: string }>();
  const router = useRouter();
  const ctx = useWsContext(id);
  const roles = useRoles(id);
  const catalogue = usePermissionCatalogue(id);
  const refresh = useRefreshWorkspace(id);
  const archive = useAction(async () => {
    await wsApi.archiveRole(id, roleId);
    await refresh();
  }, "role");
  const perms = ctx.data?.permissions ?? [];
  const role = (roles.data ?? []).find((r) => r.id === roleId);
  const manageable = role ? canManageCustomRole(role, ctx.data?.role.id ?? "", perms) : false;
  const inUse = role ? roleInUse(role) : false;

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: role?.name ?? t.title }} />
      <QueryGate queries={[ctx, roles, catalogue]}>
        {!role ? <Notice>{problemNotFound}</Notice> : null}
        {role ? (
          <>
            <Text variant="title3" bold accessibilityRole="header">
              {role.name}
            </Text>
            <Text tone="text2">{describeRole(role)}</Text>
            {role.builtin ? <Notice>{t.builtinNote}</Notice> : null}
            {can(perms, PERM.rolesManage) ? (
              <Button
                label={t.duplicate}
                variant="secondary"
                onPress={() => router.push(`/w/${id}/roles/form?duplicateOf=${role.id}` as Href)}
              />
            ) : null}
            {manageable ? (
              <Button
                label={t.edit}
                variant="secondary"
                onPress={() => router.push(`/w/${id}/roles/form?roleId=${role.id}` as Href)}
              />
            ) : null}
            {manageable && inUse ? <Notice tone="warning">{t.inUse}</Notice> : null}
            {manageable && inUse ? (
              <Button
                label={t.inUseLink}
                variant="link"
                onPress={() => router.push(`/w/${id}/team` as Href)}
              />
            ) : null}
            {manageable ? (
              <Button
                label={t.archive}
                variant="secondary"
                destructive
                disabled={inUse}
                busy={archive.pending}
                onPress={async () => {
                  if (await confirm(t.archive, t.archiveConfirm(role.name), t.archive)) {
                    const res = await archive.exec();
                    if (res.ok) router.back();
                  }
                }}
              />
            ) : null}
            {archive.error ? <Notice tone="danger">{archive.error}</Notice> : null}
            <Text variant="title3" bold accessibilityRole="header">
              {t.permissions}
            </Text>
            <PermissionList groups={buildPicker(catalogue.data ?? [], role.permissions)} />
          </>
        ) : null}
      </QueryGate>
    </Screen>
  );
}

const problemNotFound = "We couldn't find that role. It may have been archived.";
