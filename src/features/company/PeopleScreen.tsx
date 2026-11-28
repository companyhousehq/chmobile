import { useRouter, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useCompanyId } from "./useCompanyId";
import { TeamCard } from "@/features/workspace/TeamCard";
import {
  companyApi,
  useCompanyContext,
  useCompanyInvites,
  useCompanyMembers,
  useCompanyRoles,
  useRefreshCompany,
} from "@/lib/api/companies";
import {
  CPERM,
  assignableCompanyRoles,
  companyMemberActions,
  type CompanyMemberAction,
} from "@/lib/company";
import { useAction } from "@/lib/useAction";
import {
  buildTeamRows,
  can,
  filterTeamRows,
  showListControls,
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
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.ws.team;
const tp = strings.co.people;

/** People tab: company members and invited rows as cards with an action sheet (M23). */
export function PeopleScreen() {
  const id = useCompanyId();
  const router = useRouter();
  const ctx = useCompanyContext(id);
  const perms = ctx.data?.permissions ?? [];
  const canRead = can(perms, CPERM.membersRead);
  const canInvite = can(perms, CPERM.membersInvite);
  const members = useCompanyMembers(id, ctx.isSuccess && canRead);
  const invitations = useCompanyInvites(id, ctx.isSuccess && canInvite);
  const roles = useCompanyRoles(id, ctx.isSuccess && canRead);
  const refresh = useRefreshCompany(id);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TeamFilter>("all");
  const [sheetRow, setSheetRow] = useState<TeamRow | null>(null);
  const [rolePickFor, setRolePickFor] = useState<TeamRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const act = useAction(async (fn: () => Promise<unknown>, message: string) => {
    await fn();
    await refresh();
    setNotice(message);
  }, "company");
  const leaveAct = useAction(async () => {
    await companyApi.leave(id);
    await refresh();
  }, "company-leave");

  const rows = useMemo(
    () => buildTeamRows(members.data ?? [], canInvite ? (invitations.data ?? []) : []),
    [members.data, invitations.data, canInvite],
  );
  const controls = showListControls(rows.length);
  const shown = controls ? filterTeamRows(rows, query, filter) : rows;
  const roleList = roles.data ?? [];

  const run = (fn: () => Promise<unknown>, message: string) => {
    setNotice(null);
    void act.run(fn, message);
  };

  const onAction = async (row: TeamRow, action: CompanyMemberAction) => {
    const m = row.member;
    if (!m) return;
    const name = m.user.full_name;
    if (action === "change_role") return setRolePickFor(row);
    if (action === "suspend" && (await confirm(t.suspend, tp.confirmSuspend(name), t.suspend))) {
      run(() => companyApi.memberAction(id, m.id, "suspend"), t.suspended(name));
    }
    if (
      action === "reinstate" &&
      (await confirm(t.reinstate, tp.confirmReinstate(name), t.reinstate, false))
    ) {
      run(() => companyApi.memberAction(id, m.id, "reinstate"), t.reinstated(name));
    }
    if (action === "remove" && (await confirm(tp.remove, tp.confirmRemove(name), tp.remove))) {
      run(() => companyApi.memberAction(id, m.id, "remove"), t.removed(name));
    }
    if (action === "leave" && (await confirm(tp.leave, tp.confirmLeave, tp.leave))) {
      const res = await leaveAct.exec();
      if (res.ok) router.replace("/");
    }
  };

  const onInviteAction = async (row: TeamRow, kind: "resend" | "cancel") => {
    const inv = row.invitation;
    if (!inv) return;
    if (kind === "resend") {
      run(() => companyApi.invite(id, inv.email, inv.role.id), t.resent(inv.email));
    } else if (await confirm(t.cancelInvite, t.confirmCancel(inv.email), t.cancelInvite)) {
      run(() => companyApi.cancelInvite(id, inv.id), t.invitationCancelled(inv.email));
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
      row.member && ctx.data ? companyMemberActions(row.member, ctx.data, roleList) : [];
    const label: Record<CompanyMemberAction, string> = {
      change_role: t.changeRole,
      suspend: t.suspend,
      reinstate: t.reinstate,
      remove: tp.remove,
      leave: tp.leave,
    };
    return actions.map((a) => ({
      key: a,
      label: label[a],
      destructive: a === "remove" || a === "leave" || a === "suspend",
      onSelect: () => void onAction(row, a),
    }));
  };

  const pickable = rolePickFor?.member
    ? assignableCompanyRoles(roleList, perms).map<SheetOption>((r) => ({
        key: r.id,
        label: r.name,
        selected: r.id === rolePickFor.member?.role.id,
        onSelect: () => {
          const m = rolePickFor.member;
          if (!m || r.id === m.role.id) return;
          run(() => companyApi.changeRole(id, m.id, r.id), t.roleChanged(m.user.full_name, r.name));
        },
      }))
    : [];

  const gateQueries = [ctx, ...(canRead ? [members, roles] : [])];
  return (
    <Screen edges={["bottom"]}>
      <Text variant="title2" bold accessibilityRole="header">
        {tp.title}
      </Text>
      <QueryGate queries={gateQueries}>
        {!canRead ? <Notice>{tp.noRead}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {act.error ? <Notice tone="danger">{act.error}</Notice> : null}
        {leaveAct.error ? <Notice tone="danger">{leaveAct.error}</Notice> : null}
        {canInvite ? (
          <Button label={tp.invite} onPress={() => router.push(`/c/${id}/invite` as Href)} />
        ) : null}
        {canRead && !can(perms, CPERM.membersReadContact) ? (
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
          <Row title={tp.invitations} onPress={() => router.push(`/c/${id}/invitations` as Href)} />
        ) : null}
        {can(perms, CPERM.ownersManage) ? (
          <Row
            title={tp.claimNotices}
            hint={tp.claimNoticesHint}
            onPress={() => router.push(`/c/${id}/claim-notices` as Href)}
          />
        ) : null}
        <Text variant="footnote" tone="textMuted">
          {tp.lastOwner}
        </Text>
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
