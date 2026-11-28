import { useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { dropLinkToken, peekLinkToken } from "@/lib/auth/tokenStore";
import { ApiError } from "@/lib/api/client";
import { companyApi, useRefreshMyCompanies } from "@/lib/api/companies";
import { meInvitations, useRefreshMyWorkspaces } from "@/lib/api/workspaces";
import { problemMessage } from "@/lib/problems";
import { useAction } from "@/lib/useAction";
import { formatDate, type InvitationLookup } from "@/lib/workspace";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { confirm } from "@/ui/confirm";
import { IndependenceNotice } from "@/ui/IndependenceNotice";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.ws.link;
type Closed = keyof typeof t.closed;

type State =
  | { s: "loading" }
  | { s: "none" }
  | { s: "error"; message: string }
  | { s: "ready"; token: string; inv: InvitationLookup };

/**
 * Accept or decline a workspace invitation opened from a link (M8). The token
 * was parked in the secure store by the link handler; it is held here in
 * memory only and removed when the invitation is answered.
 */
export default function InvitationLink() {
  const router = useRouter();
  const { c } = useTheme();
  const refresh = useRefreshMyWorkspaces();
  const refreshCompanies = useRefreshMyCompanies();
  const [token] = useState(() => peekLinkToken("invitation", "invitation"));
  const [state, setState] = useState<State>(token ? { s: "loading" } : { s: "none" });

  useEffect(() => {
    if (!token) return;
    let live = true;
    meInvitations
      .lookup(token)
      .then((inv) => live && setState({ s: "ready", token, inv }))
      .catch((e: unknown) => {
        if (!live) return;
        const slug = e instanceof ApiError ? e.slug : "";
        if (slug === "token-invalid" || slug === "not-found") void dropLinkToken("invitation");
        setState({
          s: "error",
          message:
            slug === "token-invalid"
              ? t.invalidBody
              : problemMessage(
                  e instanceof ApiError ? e.problem : { type: "/problems/unavailable", status: 0 },
                  "invite",
                ),
        });
      });
    return () => {
      live = false;
    };
  }, [token]);

  const respond = useAction(async (kind: "accept" | "decline", id: string, company: boolean) => {
    if (company) {
      if (kind === "accept") {
        const r = await companyApi.acceptInvitation(id);
        return { href: `/c/${r.membership.company_id}` };
      }
      await companyApi.declineInvitation(id);
      return null;
    }
    if (kind === "accept") {
      const r = await meInvitations.accept(id);
      return { href: `/w/${r.membership.workspace_id}` };
    }
    await meInvitations.decline(id);
    return null;
  }, "invite");

  const finish = async (kind: "accept" | "decline", inv: InvitationLookup) => {
    if (
      kind === "decline" &&
      !(await confirm(t.decline, strings.ws.mine.confirmDecline, t.decline))
    ) {
      return;
    }
    const res = await respond.exec(kind, inv.id, inv.kind === "company");
    if (!res.ok) {
      // A reused, cancelled or expired link will never work again: drop it.
      if (res.slug === "invitation-not-pending" || res.slug === "already-member") {
        await dropLinkToken("invitation");
      }
      return;
    }
    await dropLinkToken("invitation");
    await Promise.all([refresh(), refreshCompanies()]);
    router.replace((res.value ? res.value.href : "/") as Href);
  };

  const leave = async () => {
    await dropLinkToken("invitation");
    router.replace("/");
  };

  if (state.s === "loading") {
    return (
      <Screen>
        <ActivityIndicator accessibilityLabel={strings.common.loading} color={c.accent} />
      </Screen>
    );
  }
  if (state.s === "none" || state.s === "error") {
    return (
      <Screen>
        <Text variant="title1" bold accessibilityRole="header">
          {state.s === "none" ? t.none : t.invalid}
        </Text>
        <Text tone="text2">{state.s === "none" ? t.noneBody : state.message}</Text>
        <Button label={strings.ws.mine.title} onPress={() => router.replace("/workspaces")} />
        <Button label={t.goHome} variant="link" onPress={() => void leave()} />
      </Screen>
    );
  }

  const { inv } = state;
  const isCompany = inv.kind === "company";
  const name = inv.workspace?.display_name ?? inv.company?.legal_name ?? "";
  const open = inv.status === "pending";
  return (
    <Screen>
      <Text variant="title1" bold accessibilityRole="header">
        {open ? (isCompany ? t.joinCompany(name) : t.join(name)) : t.title}
      </Text>
      <Card>
        <Text bold>{name}</Text>
        <Text variant="footnote" tone="text2">
          {(isCompany ? t.byCompany : t.by)(inv.invited_by.full_name, inv.role.name)}
        </Text>
        <Text variant="footnote" tone="textMuted">
          {t.sentTo(inv.email_hint)}
        </Text>
        <Text variant="footnote" tone="textMuted">
          {strings.ws.team.expires(formatDate(inv.expires_at))}
        </Text>
      </Card>
      {isCompany ? <Notice>{t.company}</Notice> : null}
      {!open ? (
        <Notice tone="warning">{t.closed[inv.status as Closed] ?? t.closed.expired}</Notice>
      ) : null}
      {respond.error ? <Notice tone="danger">{respond.error}</Notice> : null}
      {open ? (
        <>
          <Button
            label={t.accept}
            busy={respond.pending}
            onPress={() => void finish("accept", inv)}
          />
          <Button
            label={t.decline}
            variant="secondary"
            busy={respond.pending}
            onPress={() => void finish("decline", inv)}
          />
        </>
      ) : null}
      <IndependenceNotice />
      <Button label={t.goHome} variant="link" onPress={() => void leave()} />
    </Screen>
  );
}
