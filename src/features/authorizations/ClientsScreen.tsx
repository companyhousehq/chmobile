import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { FindClientPanel } from "./FindClientPanel";
import { AuthNote, AccessBadges } from "./parts";
import { useWorkspaceId } from "@/features/workspace/useWorkspaceId";
import {
  authApi,
  useCatalogue,
  useRefreshClients,
  useWorkspaceClients,
  useWorkspaceRequests,
} from "@/lib/api/authorizations";
import { useWsContext } from "@/lib/api/workspaces";
import {
  PORTFOLIO_FILTERS,
  WS_AUTH_PERM,
  accessDuration,
  bucketRequests,
  filterClients,
  historyDate,
  portfolioSummary,
  statusMeta,
  summarizeAccess,
  type AuthorizationItem,
  type ClientItem,
  type PortfolioFilter,
} from "@/lib/authorizations";
import { useAction } from "@/lib/useAction";
import { can, formatDate } from "@/lib/workspace";
import { strings } from "@/strings";
import { space } from "@/theme/tokens";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chips } from "@/ui/Chips";
import { confirm } from "@/ui/confirm";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.az.clients;
/** Cards shown before "Show more": keeps a large portfolio quick on a phone. */
const PAGE = 30;

type Tab = "clients" | "requests" | "find";

/** Clients (agent side, M27): portfolio, requests, and finding a company to ask. */
export function ClientsScreen() {
  const id = useWorkspaceId();
  const ctx = useWsContext(id);
  const perms = ctx.data?.permissions ?? [];
  const canResolve = can(perms, WS_AUTH_PERM.resolve);
  const canRequest = can(perms, WS_AUTH_PERM.request);
  const canClients = can(perms, WS_AUTH_PERM.clientsRead);
  const canRequests = can(perms, WS_AUTH_PERM.read) || canRequest;
  const clients = useWorkspaceClients(id, ctx.isSuccess && canClients);
  const requests = useWorkspaceRequests(id, ctx.isSuccess && canRequests);
  const catalogue = useCatalogue();
  const { tab: start } = useLocalSearchParams<{ tab?: string }>();
  const [picked, setPicked] = useState<Tab | null>(null);

  const buckets = useMemo(() => bucketRequests(requests.data ?? []), [requests.data]);

  // Each section needs its own permission; the API still decides.
  const available: Tab[] = [
    ...(canClients || !ctx.isSuccess ? (["clients"] as Tab[]) : []),
    ...(canRequests ? (["requests"] as Tab[]) : []),
    ...(canResolve ? (["find"] as Tab[]) : []),
  ];
  const wanted: Tab = picked ?? (start === "requests" ? "requests" : "clients");
  const tab: Tab = available.includes(wanted) ? wanted : (available[0] ?? "clients");
  const setTab = (v: Tab) => setPicked(v);

  return (
    <Screen edges={["bottom"]}>
      <Text variant="title2" bold accessibilityRole="header">
        {t.title}
      </Text>
      <Text tone="text2">{t.intro}</Text>
      <Chips<Tab>
        label={t.title}
        value={tab}
        onChange={setTab}
        options={available.map((value) => ({
          value,
          label:
            value === "clients"
              ? t.tabs.clients
              : value === "requests"
                ? `${t.tabs.requests}${buckets.pending.length ? ` (${buckets.pending.length})` : ""}`
                : t.tabs.find,
        }))}
      />
      {tab === "clients" ? (
        <QueryGate queries={canClients ? [ctx, clients] : [ctx]}>
          {canClients ? (
            <Portfolio
              workspaceId={id}
              clients={clients.data ?? []}
              waiting={buckets.pending.length}
              canResolve={canResolve}
              onFind={() => setTab("find")}
              catalogue={catalogue.data}
            />
          ) : null}
        </QueryGate>
      ) : null}
      {tab === "requests" ? (
        <QueryGate queries={[ctx, requests]}>
          <Requests
            workspaceId={id}
            buckets={buckets}
            canRequest={canRequest}
            clients={clients.data ?? []}
            catalogue={catalogue.data}
          />
        </QueryGate>
      ) : null}
      {tab === "find" && canResolve ? (
        <FindClientPanel workspaceId={id} canRequest={canRequest} />
      ) : null}
      <AuthNote />
    </Screen>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: "45%" }}>
      <Card>
        <Text variant="title2" bold>
          {String(value)}
        </Text>
        <Text variant="footnote" tone="text2">
          {label}
        </Text>
      </Card>
    </View>
  );
}

function Portfolio({
  workspaceId,
  clients,
  waiting,
  canResolve,
  onFind,
  catalogue,
}: {
  workspaceId: string;
  clients: ClientItem[];
  waiting: number;
  canResolve: boolean;
  onFind: () => void;
  catalogue: ReturnType<typeof useCatalogue>["data"];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PortfolioFilter>("all");
  const [limit, setLimit] = useState(PAGE);
  const sum = portfolioSummary(clients, waiting);
  const shown = filterClients(clients, query, filter);

  if (clients.length === 0) {
    return (
      <>
        <Text tone="text2">{t.emptyClients}</Text>
        {canResolve ? <Button label={t.tabs.find} onPress={onFind} /> : null}
      </>
    );
  }
  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        <SummaryCard label={t.summary.total} value={sum.total} />
        <SummaryCard label={t.summary.canEdit} value={sum.canEdit} />
        <SummaryCard label={t.summary.endingSoon} value={sum.endingSoon} />
        <SummaryCard label={t.summary.waiting} value={sum.waiting} />
      </View>
      <TextField
        label={t.search}
        value={query}
        onChangeText={(v) => {
          setQuery(v);
          setLimit(PAGE);
        }}
        autoCorrect={false}
        returnKeyType="search"
      />
      <Chips<PortfolioFilter>
        label={t.filter}
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setLimit(PAGE);
        }}
        options={[...PORTFOLIO_FILTERS]}
      />
      {shown.length === 0 ? <Text tone="textMuted">{t.noMatch}</Text> : null}
      {shown.slice(0, limit).map((c) => (
        <ClientCard
          key={c.authorization.id}
          c={c}
          catalogue={catalogue}
          onOpen={() => router.push(`/w/${workspaceId}/client/${c.company.id}` as Href)}
        />
      ))}
      {shown.length > limit ? (
        <Button
          label={strings.common.showMore}
          variant="secondary"
          onPress={() => setLimit((n) => n + PAGE)}
        />
      ) : null}
    </>
  );
}

function ClientCard({
  c,
  onOpen,
  catalogue,
}: {
  c: ClientItem;
  onOpen: () => void;
  catalogue: ReturnType<typeof useCatalogue>["data"];
}) {
  const ident = c.company.primary_identifier?.identifier_display;
  return (
    <Card>
      <Text bold>{c.company.legal_name}</Text>
      {ident ? (
        <Text variant="footnote" tone="textMuted">
          {ident}
        </Text>
      ) : null}
      <Text variant="footnote" tone="text2">
        {summarizeAccess(c.authorization.action_scopes)} ·{" "}
        {accessDuration(c.authorization.expires_at)}
      </Text>
      <AccessBadges
        scopes={[]}
        categories={c.authorization.service_categories}
        catalogue={catalogue}
      />
      <Button label={t.open} variant="secondary" onPress={onOpen} />
    </Card>
  );
}

function Requests({
  workspaceId,
  buckets,
  canRequest,
  clients,
  catalogue,
}: {
  workspaceId: string;
  buckets: ReturnType<typeof bucketRequests>;
  canRequest: boolean;
  clients: ClientItem[];
  catalogue: ReturnType<typeof useCatalogue>["data"];
}) {
  const router = useRouter();
  const refresh = useRefreshClients(workspaceId);
  const [notice, setNotice] = useState<string | null>(null);
  const cancel = useAction(async (a: AuthorizationItem) => {
    await authApi.cancel(workspaceId, a.id);
    await refresh();
  }, "authorization");

  const doCancel = async (a: AuthorizationItem) => {
    setNotice(null);
    if (!(await confirm(t.cancelTitle, t.cancelBody(a.company.legal_name), t.cancel))) return;
    const res = await cancel.exec(a);
    if (res.ok) setNotice(t.cancelled);
  };
  const hasActiveOrPending = (companyId: string) =>
    clients.some((c) => c.company.id === companyId) ||
    buckets.pending.some((p) => p.company.id === companyId);

  return (
    <>
      <Text variant="footnote" tone="text2" bold accessibilityRole="header">
        {t.pending}
      </Text>
      <Notice>{strings.az.noAccessUntil}</Notice>
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {cancel.error ? <Notice tone="danger">{cancel.error}</Notice> : null}
      {buckets.pending.length === 0 ? <Text tone="textMuted">{t.pendingEmpty}</Text> : null}
      {buckets.pending.map((a) => (
        <Card key={a.id}>
          <Text bold>{a.company.legal_name}</Text>
          <Badge label={t.pending} tone="warning" />
          {a.supersedes_authorization_id ? <Badge label={t.moreRequested} /> : null}
          <AccessBadges
            scopes={a.requested_action_scopes}
            categories={a.requested_service_categories}
            catalogue={catalogue}
          />
          <Text variant="footnote" tone="textMuted">
            {t.sent(formatDate(a.requested_at))}
            {a.request_expires_at ? ` · ${t.requestEnds(formatDate(a.request_expires_at))}` : ""}
          </Text>
          {a.request_note ? (
            <Text tone="text2">{strings.az.company.reasonQuote(a.request_note)}</Text>
          ) : null}
          {canRequest ? (
            <Button
              label={t.cancel}
              variant="secondary"
              busy={cancel.pending}
              onPress={() => void doCancel(a)}
            />
          ) : null}
        </Card>
      ))}
      <Text variant="footnote" tone="text2" bold accessibilityRole="header">
        {t.past}
      </Text>
      {buckets.past.length === 0 ? <Text tone="textMuted">{t.pastEmpty}</Text> : null}
      {buckets.past.map((a) => {
        const st = statusMeta(a.status, a.ended_reason);
        return (
          <Card key={a.id}>
            <Text bold>{a.company.legal_name}</Text>
            <Badge label={st.label} tone={st.tone} />
            <Text variant="footnote" tone="textMuted">
              {formatDate(historyDate(a))}
            </Text>
            {a.decision_note ? (
              <Text tone="text2">{strings.az.company.reasonQuote(a.decision_note)}</Text>
            ) : null}
            {canRequest && !hasActiveOrPending(a.company.id) ? (
              <Button
                label={t.again}
                variant="secondary"
                onPress={() =>
                  router.push(
                    `/w/${workspaceId}/request-access?companyId=${a.company.id}&name=${encodeURIComponent(a.company.legal_name)}` as Href,
                  )
                }
              />
            ) : null}
          </Card>
        );
      })}
    </>
  );
}
