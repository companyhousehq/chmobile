import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import {
  companyApi,
  useMyClaims,
  useMyCompanyInvitations,
  useRefreshMyCompanies,
} from "@/lib/api/companies";
import { useContextLists, useMe } from "@/lib/api/queries";
import { claimStatusMeta } from "@/lib/company";
import { useAction } from "@/lib/useAction";
import { formatDate } from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { confirm } from "@/ui/confirm";
import { IndependenceNotice } from "@/ui/IndependenceNotice";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.co.mine;

/**
 * You > My companies and claims (M20, AC30): memberships with role, company
 * invitations and claims, each listed separately.
 */
export function MyCompaniesScreen() {
  const router = useRouter();
  const me = useMe();
  const lists = useContextLists(me.data?.id);
  const invitations = useMyCompanyInvitations();
  const claims = useMyClaims();
  const refresh = useRefreshMyCompanies();
  const [notice, setNotice] = useState<string | null>(null);
  const act = useAction(async (fn: () => Promise<unknown>) => fn(), "invite");

  const respond = async (id: string, name: string, kind: "accept" | "decline") => {
    setNotice(null);
    if (kind === "decline" && !(await confirm(t.decline, t.confirmDecline, t.decline))) return;
    const res = await act.exec(() =>
      kind === "accept" ? companyApi.acceptInvitation(id) : companyApi.declineInvitation(id),
    );
    if (!res.ok) return;
    await refresh();
    if (kind === "accept") {
      const v = res.value as { membership: { company_id: string } };
      setNotice(t.accepted(name));
      router.replace(`/c/${v.membership.company_id}` as Href);
    } else setNotice(t.declined);
  };

  return (
    <Screen edges={["bottom"]}>
      <QueryGate queries={[lists, invitations, claims]}>
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {act.error ? <Notice tone="danger">{act.error}</Notice> : null}

        <Text variant="footnote" tone="textMuted" bold accessibilityRole="header">
          {t.companies}
        </Text>
        {(lists.data?.companies ?? []).length === 0 ? (
          <Text tone="textMuted">{t.emptyCompanies}</Text>
        ) : null}
        {(lists.data?.companies ?? []).map((c) => (
          <Row
            key={c.company.id}
            title={c.company.legal_name}
            hint={c.membership.role.name}
            onPress={() => router.replace(`/c/${c.company.id}` as Href)}
          />
        ))}

        {(invitations.data ?? []).length > 0 ? (
          <>
            <Text variant="footnote" tone="textMuted" bold accessibilityRole="header">
              {t.invitations}
            </Text>
            {(invitations.data ?? []).map((inv) => (
              <Card key={inv.id}>
                <Text bold>{inv.company.legal_name}</Text>
                <Text variant="footnote" tone="text2">
                  {t.invitedBy(inv.invited_by.full_name, inv.role.name)}
                </Text>
                <Text variant="footnote" tone="textMuted">
                  {t.expires(formatDate(inv.expires_at))}
                </Text>
                <Button
                  label={`${t.accept}: ${inv.company.legal_name}`}
                  busy={act.pending}
                  onPress={() => void respond(inv.id, inv.company.legal_name, "accept")}
                />
                <Button
                  label={`${t.decline}: ${inv.company.legal_name}`}
                  variant="link"
                  busy={act.pending}
                  onPress={() => void respond(inv.id, inv.company.legal_name, "decline")}
                />
              </Card>
            ))}
          </>
        ) : null}

        <Text variant="footnote" tone="textMuted" bold accessibilityRole="header">
          {t.claims}
        </Text>
        {(claims.data ?? []).length === 0 ? <Text tone="textMuted">{t.emptyClaims}</Text> : null}
        {(claims.data ?? []).map((cl) => {
          const m = claimStatusMeta(cl.status);
          return (
            <Row
              key={cl.id}
              title={cl.company.legal_name}
              hint={t.claimedOn(formatDate(cl.submitted_at))}
              right={<Badge label={m.label} tone={m.tone} />}
              onPress={() => router.push(`/companies/claims/${cl.id}` as Href)}
            />
          );
        })}
        <Button label={t.find} onPress={() => router.push("/companies/find")} />
        <IndependenceNotice />
      </QueryGate>
    </Screen>
  );
}
