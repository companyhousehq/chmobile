import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { AuthNote, AccessBadges } from "./parts";
import { useCompanyId } from "@/features/company/useCompanyId";
import { useCatalogue, useCompanyAuthorizations } from "@/lib/api/authorizations";
import { useCompanyContext } from "@/lib/api/companies";
import {
  COMPANY_AUTH_PERM,
  accessDuration,
  bucketAuthorizations,
  historyDate,
  statusMeta,
  summarizeAccess,
  type AuthorizationItem,
} from "@/lib/authorizations";
import { can, formatDate } from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chips } from "@/ui/Chips";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.az.company;

type Tab = "waiting" | "active" | "history";

/**
 * Agents & advisers (M25): who is asking, who has access, and what happened.
 * Members without approve or revoke rights see the same lists with no actions.
 */
export function CompanyAgentsScreen() {
  const id = useCompanyId();
  const router = useRouter();
  const ctx = useCompanyContext(id);
  const list = useCompanyAuthorizations(id, ctx.isSuccess);
  const catalogue = useCatalogue();
  const perms = ctx.data?.permissions ?? [];
  const canApprove = can(perms, COMPANY_AUTH_PERM.approve);
  const [picked, setPicked] = useState<Tab | null>(null);

  const buckets = bucketAuthorizations(list.data ?? []);
  const tab: Tab = picked ?? (buckets.waiting.length > 0 ? "waiting" : "active");
  const shown = buckets[tab];

  return (
    <Screen edges={["bottom"]}>
      <Text variant="title2" bold accessibilityRole="header">
        {t.title}
      </Text>
      <Text tone="text2">{t.intro}</Text>
      <AuthNote />
      <QueryGate queries={[ctx, list]}>
        {!canApprove ? <Notice>{t.readOnly}</Notice> : null}
        <Chips<Tab>
          label={t.title}
          value={tab}
          onChange={setPicked}
          options={[
            {
              value: "waiting",
              label: `${t.waiting}${buckets.waiting.length ? ` (${buckets.waiting.length})` : ""}`,
            },
            { value: "active", label: `${t.active} (${buckets.active.length})` },
            { value: "history", label: t.history },
          ]}
        />
        {canApprove ? (
          <Button
            label={t.allowSomeone}
            variant="secondary"
            onPress={() => router.push(`/c/${id}/access/grant` as Href)}
          />
        ) : null}
        {shown.length === 0 ? (
          <Text tone="textMuted">
            {tab === "waiting" ? t.emptyWaiting : tab === "active" ? t.emptyActive : t.emptyHistory}
          </Text>
        ) : (
          shown.map((a) => (
            <AgentCard
              key={a.id}
              a={a}
              tab={tab}
              catalogue={catalogue.data}
              onOpen={() => router.push(`/c/${id}/access/${a.id}` as Href)}
            />
          ))
        )}
      </QueryGate>
    </Screen>
  );
}

function AgentCard({
  a,
  tab,
  catalogue,
  onOpen,
}: {
  a: AuthorizationItem;
  tab: Tab;
  catalogue: ReturnType<typeof useCatalogue>["data"];
  onOpen: () => void;
}) {
  const verified = a.workspace.verification_status === "verified";
  const st = statusMeta(a.status, a.ended_reason);
  const pending = tab === "waiting";
  const scopes = pending ? a.requested_action_scopes : a.action_scopes;
  const cats = pending ? a.requested_service_categories : a.service_categories;
  return (
    <Card>
      <Text bold>{a.workspace.display_name}</Text>
      <Badge
        label={verified ? t.verified : t.notVerified}
        tone={verified ? "success" : "neutral"}
      />
      {tab === "history" ? <Badge label={st.label} tone={st.tone} /> : null}
      {pending ? (
        <>
          {a.supersedes_authorization_id ? <Badge label={t.moreAccess} tone="warning" /> : null}
          <Text variant="footnote" tone="textMuted">
            {t.sentBy(a.requested_by?.full_name ?? "", formatDate(a.requested_at))}
          </Text>
          {a.request_expires_at ? (
            <Text variant="footnote" tone="textMuted">
              {t.requestEnds(formatDate(a.request_expires_at))}
            </Text>
          ) : null}
          <AccessBadges scopes={scopes} categories={cats} catalogue={catalogue} />
          {a.request_note ? <Text tone="text2">{t.reasonQuote(a.request_note)}</Text> : null}
        </>
      ) : (
        <>
          <Text variant="footnote" tone="text2">
            {summarizeAccess(a.action_scopes)}
          </Text>
          <Text variant="footnote" tone="textMuted">
            {tab === "active" ? accessDuration(a.expires_at) : formatDate(historyDate(a))}
          </Text>
        </>
      )}
      <Button
        label={pending ? t.open : tab === "active" ? t.manage : t.details}
        variant="secondary"
        onPress={onOpen}
      />
    </Card>
  );
}
