import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
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
  permissionsToSend,
  roleNameError,
  togglePermission,
  type WorkspacePermissionItem,
  type WorkspaceRole,
} from "@/lib/workspace";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.ws.roles;

/** Create, duplicate or edit a custom role with grouped toggles from the live catalogue. */
export function RoleFormScreen() {
  const id = useWorkspaceId();
  const { roleId, duplicateOf } = useLocalSearchParams<{ roleId?: string; duplicateOf?: string }>();
  const ctx = useWsContext(id);
  const roles = useRoles(id);
  const catalogue = usePermissionCatalogue(id);
  const source = (roles.data ?? []).find((r) => r.id === (roleId ?? duplicateOf));
  const allowed = can(ctx.data?.permissions, PERM.rolesManage);

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: roleId ? t.formEdit : t.formCreate }} />
      <QueryGate queries={[ctx, roles, catalogue]}>
        {!allowed ? (
          <Notice>Your role doesn&apos;t allow this. Ask an Owner of this workspace.</Notice>
        ) : (
          <RoleForm
            workspaceId={id}
            roleId={roleId}
            source={source}
            catalogue={catalogue.data ?? []}
          />
        )}
      </QueryGate>
    </Screen>
  );
}

function RoleForm({
  workspaceId,
  roleId,
  source,
  catalogue,
}: {
  workspaceId: string;
  roleId?: string;
  source?: WorkspaceRole;
  catalogue: WorkspacePermissionItem[];
}) {
  const router = useRouter();
  const refresh = useRefreshWorkspace(workspaceId);
  const [name, setName] = useState(() =>
    source ? (roleId ? source.name : t.copyOf(source.name)) : "",
  );
  const [description, setDescription] = useState(source?.description ?? "");
  const [selected, setSelected] = useState<string[]>(source?.permissions ?? []);
  const [nameError, setNameError] = useState<string | undefined>();

  const save = useAction(async () => {
    const body = {
      name: name.trim(),
      description: description.trim(),
      permissions: permissionsToSend(catalogue, selected),
    };
    if (roleId) await wsApi.updateRole(workspaceId, roleId, body);
    else await wsApi.createRole(workspaceId, body);
    await refresh();
  }, "role");

  const submit = async () => {
    const e = roleNameError(name);
    setNameError(e ?? undefined);
    if (e) return;
    const res = await save.exec();
    if (res.ok) router.back();
  };

  const groups = buildPicker(catalogue, selected);
  return (
    <>
      <TextField
        label={t.name}
        value={name}
        onChangeText={setName}
        maxLength={60}
        error={nameError ?? save.fields.name}
      />
      <TextField
        label={t.description}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={300}
      />
      <Text variant="title3" bold accessibilityRole="header">
        {t.permissions}
      </Text>
      {save.fields.permissions ? (
        <Text variant="footnote" tone="dangerFg">
          {save.fields.permissions}
        </Text>
      ) : null}
      <PermissionList
        groups={groups}
        onToggle={(key) => {
          const item = groups.flatMap((g) => g.items).find((i) => i.key === key);
          if (item) setSelected((s) => togglePermission(s, item));
        }}
      />
      {save.error ? <Notice tone="danger">{save.error}</Notice> : null}
      <Button label={t.save} busy={save.pending} onPress={() => void submit()} />
    </>
  );
}
