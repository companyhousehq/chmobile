import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  AccessBadges,
  AuthNote,
  CategoryPicker,
  ExpiryPicker,
  ScopePicker,
  SectionLabel,
} from "./parts";
import { useCompanyId } from "@/features/company/useCompanyId";
import {
  authApi,
  useCatalogue,
  useCompanyAuthorizations,
  useRefreshCompanyAuthz,
} from "@/lib/api/authorizations";
import { useCompanyContext } from "@/lib/api/companies";
import {
  COMPANY_AUTH_PERM,
  accessDuration,
  approveBody,
  categoryLabel,
  expiryForPreset,
  inOrder,
  limitProblems,
  sameSet,
  scopeOptions,
  statusMeta,
  summarizeAccess,
  type AuthorizationItem,
  type ExpiryPreset,
} from "@/lib/authorizations";
import { useAction } from "@/lib/useAction";
import { can, formatDate } from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { confirm } from "@/ui/confirm";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.az.company;

type Mode = "view" | "limits" | "decline" | "remove";

/**
 * One request or access: who, what, areas, expiry and note; then the actions
 * the caller's role allows. Authorization-request emails open the list; this
 * screen is one tap from it (M25, M26).
 */
export function AuthorizationDetailScreen() {
  const id = useCompanyId();
  const { authId } = useLocalSearchParams<{ authId: string }>();
  const ctx = useCompanyContext(id);
  const list = useCompanyAuthorizations(id, ctx.isSuccess);
  const item = (list.data ?? []).find((a) => a.id === authId);
  const perms = ctx.data?.permissions ?? [];
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.review }} />
      <QueryGate queries={[ctx, list]}>
        {item ? (
          <Body
            key={item.status + item.updated_at}
            companyId={id}
            a={item}
            canApprove={can(perms, COMPANY_AUTH_PERM.approve)}
            canRevoke={can(perms, COMPANY_AUTH_PERM.revoke)}
          />
        ) : (
          <Notice>{t.notFound}</Notice>
        )}
      </QueryGate>
      <AuthNote />
    </Screen>
  );
}

function Body({
  companyId,
  a,
  canApprove,
  canRevoke,
}: {
  companyId: string;
  a: AuthorizationItem;
  canApprove: boolean;
  canRevoke: boolean;
}) {
  const catalogue = useCatalogue();
  const refresh = useRefreshCompanyAuthz(companyId);
  const [mode, setMode] = useState<Mode>("view");
  const [done, setDone] = useState<string | null>(null);

  const pending = a.status === "pending";
  const active = a.status === "active";
  const st = statusMeta(a.status, a.ended_reason);
  const verified = a.workspace.verification_status === "verified";
  const scopes = pending ? a.requested_action_scopes : a.action_scopes;
  const cats = pending ? a.requested_service_categories : a.service_categories;

  const approve = useAction(async (body: Record<string, unknown>) => {
    await authApi.approve(companyId, a.id, body);
    await refresh();
  }, "authorization");
  const reject = useAction(async (note: string) => {
    await authApi.reject(companyId, a.id, note);
    await refresh();
  }, "authorization");
  const narrow = useAction(async (body: Record<string, unknown>) => {
    await authApi.narrow(companyId, a.id, body);
    await refresh();
  }, "authorization");
  const revoke = useAction(async (reason: string) => {
    await authApi.revoke(companyId, a.id, reason);
    await refresh();
  }, "authorization");

  const allowAsked = async () => {
    const ok = await confirm(
      t.allow,
      `${a.workspace.display_name}: ${summarizeAccess(a.requested_action_scopes)}. ${accessDuration(a.expires_at)}.`,
      t.allow,
      false,
    );
    if (!ok) return;
    const res = await approve.exec(
      approveBody({ limited: false, scopes: [], categories: [], expiresOn: "", note: "" }),
    );
    if (res.ok) setDone(t.allowed);
  };

  return (
    <>
      <Text variant="title2" bold accessibilityRole="header">
        {a.workspace.display_name}
      </Text>
      <Badge
        label={verified ? t.verified : t.notVerified}
        tone={verified ? "success" : "neutral"}
      />
      <Badge label={st.label} tone={st.tone} />
      {done ? <Notice tone="success">{done}</Notice> : null}

      <Card>
        <SectionLabel>{pending ? t.asked : strings.az.scopesTitle}</SectionLabel>
        <AccessBadges scopes={scopes} categories={cats} catalogue={catalogue.data} />
        <Text variant="footnote" tone="textMuted">
          {accessDuration(a.expires_at)}
        </Text>
        {pending && a.request_expires_at ? (
          <Text variant="footnote" tone="textMuted">
            {t.requestEnds(formatDate(a.request_expires_at))}
          </Text>
        ) : null}
        {pending && a.supersedes_authorization_id ? (
          <Badge label={t.moreAccess} tone="warning" />
        ) : null}
        {a.requested_by ? (
          <Text variant="footnote" tone="textMuted">
            {t.sentBy(a.requested_by.full_name, formatDate(a.requested_at))}
          </Text>
        ) : null}
        {a.request_note ? <Text tone="text2">{t.reasonQuote(a.request_note)}</Text> : null}
        {a.decided_by && a.decided_at ? (
          <Text variant="footnote" tone="textMuted">
            {t.decidedBy(a.decided_by.full_name, formatDate(a.decided_at))}
          </Text>
        ) : null}
        {a.decision_note ? <Text tone="text2">{t.reasonQuote(a.decision_note)}</Text> : null}
        {a.ended_at && a.ended_by ? (
          <Text variant="footnote" tone="textMuted">
            {t.endedBy(a.ended_by.full_name, formatDate(a.ended_at))}
          </Text>
        ) : null}
      </Card>

      {mode === "view" ? (
        <>
          {pending && canApprove ? (
            <>
              <Button label={t.allow} busy={approve.pending} onPress={() => void allowAsked()} />
              <Button label={t.allowLimits} variant="secondary" onPress={() => setMode("limits")} />
              <Button
                label={t.decline}
                variant="secondary"
                destructive
                onPress={() => setMode("decline")}
              />
              {approve.error ? <Notice tone="danger">{approve.error}</Notice> : null}
            </>
          ) : null}
          {active && canApprove ? (
            <Button label={t.narrow} variant="secondary" onPress={() => setMode("limits")} />
          ) : null}
          {active && canRevoke ? (
            <Button
              label={t.remove}
              variant="secondary"
              destructive
              onPress={() => setMode("remove")}
            />
          ) : null}
        </>
      ) : null}

      {mode === "limits" ? (
        <LimitsForm
          a={a}
          pending={pending}
          catalogue={catalogue.data}
          busy={approve.pending || narrow.pending}
          error={approve.error ?? narrow.error}
          fields={{ ...approve.fields, ...narrow.fields }}
          onCancel={() => setMode("view")}
          onSubmit={async (body) => {
            const res = pending ? await approve.exec(body) : await narrow.exec(body);
            if (res.ok) {
              setDone(pending ? t.allowed : t.reduced);
              setMode("view");
            }
          }}
        />
      ) : null}

      {mode === "decline" ? (
        <NoteForm
          label={t.declineNote}
          hint={t.declineNoteHint}
          action={t.declineConfirm}
          destructive
          busy={reject.pending}
          error={reject.error}
          onCancel={() => setMode("view")}
          onSubmit={async (note) => {
            const res = await reject.exec(note);
            if (res.ok) {
              setDone(t.declined);
              setMode("view");
            }
          }}
        />
      ) : null}

      {mode === "remove" ? (
        <NoteForm
          label={t.removeReason}
          action={t.remove}
          destructive
          busy={revoke.pending}
          error={revoke.error}
          onCancel={() => setMode("view")}
          onSubmit={async (reason) => {
            const ok = await confirm(
              t.removeConfirmTitle,
              t.removeConfirm(a.workspace.display_name),
              t.remove,
            );
            if (!ok) return;
            const res = await revoke.exec(reason);
            if (res.ok) {
              setDone(t.removeDone);
              setMode("view");
            }
          }}
        />
      ) : null}
    </>
  );
}

function NoteForm({
  label,
  hint,
  action,
  destructive,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  label: string;
  hint?: string;
  action: string;
  destructive?: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  return (
    <>
      <TextField
        label={label}
        hint={hint}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={2000}
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        label={action}
        destructive={destructive}
        busy={busy}
        onPress={() => void onSubmit(note)}
      />
      <Button label={strings.common.cancel} variant="link" disabled={busy} onPress={onCancel} />
    </>
  );
}

/** Allow with limits (a pending request) or reduce access (an active one): subsets and a sooner end only. */
function LimitsForm({
  a,
  pending,
  catalogue,
  busy,
  error,
  fields,
  onCancel,
  onSubmit,
}: {
  a: AuthorizationItem;
  pending: boolean;
  catalogue: ReturnType<typeof useCatalogue>["data"];
  busy: boolean;
  error: string | null;
  fields: Record<string, string>;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const askedScopes = pending ? a.requested_action_scopes : a.action_scopes;
  const askedCats = pending ? a.requested_service_categories : a.service_categories;
  const askedEnd = a.expires_at;
  const all = scopeOptions(catalogue);
  const scopeChoices = all.filter((o) => askedScopes.includes(o.key));
  const catChoices = askedCats.map((k) => ({
    key: k,
    label: categoryLabel(k, catalogue?.service_categories),
  }));

  const [scopes, setScopes] = useState<string[]>(inOrder(askedScopes, scopeChoices));
  const [cats, setCats] = useState<string[]>([...askedCats]);
  const [preset, setPreset] = useState<ExpiryPreset>("3m");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sooner, setSooner] = useState(false);

  const expiresOn = sooner ? expiryForPreset(preset, date) : "";

  const submit = async () => {
    const e = limitProblems(
      { scopes: askedScopes, categories: askedCats, expiresAt: askedEnd },
      { scopes, categories: cats, expiresOn },
    );
    setErrors(e);
    if (Object.keys(e).length) return;
    if (sameSet(scopes, askedScopes) && sameSet(cats, askedCats) && !expiresOn) {
      return setErrors({ action_scopes: t.nothingChanged });
    }
    const body = approveBody({ limited: true, scopes, categories: cats, expiresOn, note });
    await onSubmit(pending ? body : stripNote(body));
  };

  const err = (k: string) => errors[k] ?? fields[k];
  return (
    <>
      <Text bold accessibilityRole="header">
        {pending ? t.allowLimits : t.narrow}
      </Text>
      <ScopePicker
        label={t.allowOnly}
        options={scopeChoices}
        value={scopes}
        onChange={setScopes}
        error={err("action_scopes")}
      />
      <CategoryPicker
        label={strings.az.areasTitle}
        options={catChoices}
        value={cats}
        onChange={setCats}
        error={err("service_categories")}
      />
      <Button
        label={sooner ? t.keepEnd : t.shorterEnd}
        variant="secondary"
        onPress={() => setSooner((v) => !v)}
      />
      {sooner ? (
        <ExpiryPicker
          preset={preset}
          withNone={false}
          onPreset={setPreset}
          date={date}
          onDate={setDate}
          error={err("expires_at")}
        />
      ) : (
        <Text variant="footnote" tone="textMuted">
          {accessDuration(askedEnd)}
        </Text>
      )}
      {pending ? (
        <TextField
          label={t.allowNote}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={2000}
        />
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        label={pending ? t.allowLimits : t.narrow}
        busy={busy}
        onPress={() => void submit()}
      />
      <Button label={strings.common.cancel} variant="link" disabled={busy} onPress={onCancel} />
    </>
  );
}

/** Narrowing has no decision note: send only what the API reads. */
function stripNote(body: Record<string, unknown>): Record<string, unknown> {
  const { decision_note: _drop, ...rest } = body;
  return rest;
}
