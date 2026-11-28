import { useRouter, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { TeamCard } from "./TeamCard";
import { useWorkspaceId } from "./useWorkspaceId";
import {
  useInvitations,
  useMembers,
  useRefreshWorkspace,
  useRoles,
  useWorkspace,
  useWsContext,
  wsApi,
} from "@/lib/api/workspaces";
import { useAction } from "@/lib/useAction";
import {
  PERM,
  assignableRoles,
  buildTeamRows,
  can,
  filterTeamRows,
  memberActions,
  showListControls,
  showRoles,
  type MemberAction,
  type TeamFilter,
  type TeamRow,
} from "@/lib/workspace";
import { strings } from "@/strings";
import { ActionSheet, type SheetOption } from "@/ui/ActionSheet";
import { Button } from "@/ui/Button";
import { Chips } from "@/ui/Chips";
import { confirm } from "@/ui/confirm";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";
import { Text } from "@/ui/Text";

const t = strings.ws.team;

/** Team tab: members and invited rows as cards with an action sheet (M10, OQ-8). */
export function TeamScreen() {
  const id = useWorkspaceId();
  const router = useRouter();
  const ctx = useWsContext(id);
  const workspace = useWorkspace(id);
  const perms = ctx.data?.permissions ?? [];
  const canRead = can(perms, PERM.membersRead);
  const canInvite = can(perms, PERM.membersInvite);
  const members = useMembers(id, ctx.isSuccess && canRead);
  const invitations = useInvitations(id, "pending,expired", ctx.isSuccess && canInvite);
  const roles = useRoles(id, ctx.isSuccess && canRead);
  const refresh = useRefreshWorkspace(id);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TeamFilter>("all");
  const [sheetRow, setSheetRow] = useState<TeamRow | null>(null);
  const [rolePickFor, setRolePickFor] = useState<TeamRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const act = useAction(async (fn: () => Promise<unknown>, message: string) => {
    await fn();
    await refresh();
    setNotice(message);
  }, "member");
  const leaveAct = useAction(async () => {
    await wsApi.leave(id);
    await refresh();
  }, "leave");

  const rows = useMemo(
    () => buildTeamRows(members.data ?? [], canInvite ? (invitations.data ?? []) : []),
    [members.data, invitations.data, canInvite],
  );
  const controls = showListControls(rows.length);
  const shown = controls ? filterTeamRows(rows, query, filter) : rows;
  const roleList = roles.data ?? [];
  const wsType = workspace.data?.type ?? "agency";

  const run = (fn: () => Promise<unknown>, message: string) => {
    setNotice(null);
    void act.run(fn, message);
  };

  const onAction = async (row: TeamRow, action: MemberAction) => {
    const m = row.member;
    if (!m) return;
    const name = m.user.full_name;
    if (action === "change_role") return setRolePickFor(row);
    if (action === "suspend" && (await confirm(t.suspend, t.confirmSuspend(name), t.suspend))) {
      run(() => wsApi.memberAction(id, m.id, "suspend"), t.suspended(name));
    }
    if (
      action === "reinstate" &&
      (await confirm(t.reinstate, t.confirmReinstate(name), t.reinstate, false))
    ) {
      run(() => wsApi.memberAction(id, m.id, "reinstate"), t.reinstated(name));
    }
    if (action === "remove" && (await confirm(t.remove, t.confirmRemove(name), t.remove))) {
      run(() => wsApi.memberAction(id, m.id, "remove"), t.removed(name));
    }
    if (action === "leave" && (await confirm(t.leave, t.confirmLeave, t.leave))) {
      const res = await leaveAct.exec();
      if (res.ok) router.replace("/");
    }
  };

  const onInviteAction = async (row: TeamRow, kind: "resend" | "cancel") => {
    const inv = row.invitation;
    if (!inv) return;
    if (kind === "resend") {
      run(() => wsApi.invite(id, inv.email, inv.role.id), t.resent(inv.email));
    } else if (await confirm(t.cancelInvite, t.confirmCancel(inv.email), t.cancelInvite)) {
      run(() => wsApi.cancelInvitation(id, inv.id), t.invitationCancelled(inv.email));
    }
  };

  const optionsFor = (row: TeamRow): SheetOption[] => {
    if (row.kind === "invited") {
      return [
        { key: "resend", label: t.resend, onSelect: () => void onInviteAction(row, "resend") },
        {
          key: "cancel",
          label: t.cancelInvite,
          destructive: true,
          onSelect: () => void onInviteAction(row, "cancel"),
        },
      ];
    }
    const actions =
      row.member && ctx.data ? memberActions(row.member, ctx.data, roleList, wsType) : [];
    const label: Record<MemberAction, string> = {
      change_role: t.changeRole,
      suspend: t.suspend,
      reinstate: t.reinstate,
      remove: t.remove,
      leave: t.leave,
    };
    return actions.map((a) => ({
      key: a,
      label: label[a],
      destructive: a === "remove" || a === "leave" || a === "suspend",
      onSelect: () => void onAction(row, a),
    }));
  };

  const pickable = rolePickFor?.member
    ? assignableRoles(roleList, perms).map<SheetOption>((r) => ({
        key: r.id,
        label: r.name,
        selected: r.id === rolePickFor.member?.role.id,
        onSelect: () => {
          const m = rolePickFor.member;
          if (!m || r.id === m.role.id) return;
          run(() => wsApi.changeRole(id, m.id, r.id), t.roleChanged(m.user.full_name, r.name));
        },
      }))
    : [];

  const gateQueries = [ctx, ...(canRead ? [members, roles] : [])];
  return (
    <Screen edges={["bottom"]}>
      <Text variant="title2" bold accessibilityRole="header">
        {t.title}
      </Text>
      <QueryGate queries={gateQueries}>
        {!canRead ? <Notice>{t.noRead}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {act.error ? <Notice tone="danger">{act.error}</Notice> : null}
        {leaveAct.error ? <Notice tone="danger">{leaveAct.error}</Notice> : null}
        {canInvite ? (
          <Button label={t.invite} onPress={() => router.push(`/w/${id}/invite` as Href)} />
        ) : null}
        {canRead && !can(perms, PERM.membersReadContact) ? (
          <Text variant="footnote" tone="textMuted">
            {t.contactHidden}
          </Text>
        ) : null}
        {controls ? (
          <View style={{ gap: 8 }}>
            <TextField
              label={t.search}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            <Chips
              label={t.filter}
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: t.filterAll },
                { value: "active", label: t.filterActive },
                { value: "suspended", label: t.filterSuspended },
                ...(canInvite ? [{ value: "invited" as const, label: t.filterInvited }] : []),
              ]}
            />
          </View>
        ) : null}
        {shown.length === 0 && canRead ? <Text tone="textMuted">{t.empty}</Text> : null}
        {shown.map((row) => (
          <TeamCard
            key={`${row.kind}:${row.id}`}
            row={row}
            own={row.member?.id === ctx.data?.membership_id}
            hasActions={optionsFor(row).length > 0}
            onActions={() => setSheetRow(row)}
          />
        ))}
        {canInvite ? (
          <Row title={t.invitations} onPress={() => router.push(`/w/${id}/invitations` as Href)} />
        ) : null}
        {showRoles(wsType, perms) ? (
          <Row title={t.roles} onPress={() => router.push(`/w/${id}/roles` as Href)} />
        ) : null}
      </QueryGate>
      <ActionSheet
        visible={!!sheetRow}
        title={sheetRow?.title ?? ""}
        options={sheetRow ? optionsFor(sheetRow) : []}
        onClose={() => setSheetRow(null)}
      />
      <ActionSheet
        visible={!!rolePickFor}
        title={t.changeRoleTitle(rolePickFor?.title ?? "")}
        options={pickable}
        onClose={() => setRolePickFor(null)}
      />
    </Screen>
  );
}
