import { Stack, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { AuthNote, CategoryPicker, ExpiryPicker, ScopePicker } from "./parts";
import { useCompanyId } from "@/features/company/useCompanyId";
import {
  authApi,
  keyForBody,
  useCatalogue,
  useRefreshCompanyAuthz,
} from "@/lib/api/authorizations";
import { useCompanyContext } from "@/lib/api/companies";
import {
  COMPANY_AUTH_PERM,
  expiryForPreset,
  expiryProblem,
  parseWorkspaceRef,
  scopeOptions,
  type ExpiryPreset,
  type WorkspaceSummary,
} from "@/lib/authorizations";
import { useAction } from "@/lib/useAction";
import { can } from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.az.company;
const g = t.grant;

/** Allow someone: a pasted workspace reference, a look-up, then what to allow (M25). */
export function GrantScreen() {
  const id = useCompanyId();
  const router = useRouter();
  const ctx = useCompanyContext(id);
  const catalogue = useCatalogue();
  const refresh = useRefreshCompanyAuthz(id);
  const keys = useRef(new Map<string, string>());

  const [ref, setRef] = useState("");
  const [refError, setRefError] = useState<string | undefined>();
  const [who, setWho] = useState<WorkspaceSummary | null>(null);
  const [scopes, setScopes] = useState<string[]>(["company_profile.read"]);
  const [cats, setCats] = useState<string[]>([]);
  const [preset, setPreset] = useState<ExpiryPreset>("none");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const canApprove = can(ctx.data?.permissions, COMPANY_AUTH_PERM.approve);
  const find = useAction(async (workspaceId: string) => {
    const w = await authApi.lookupWorkspace(id, workspaceId);
    setWho(w);
    setCats(w.declared_service_categories.filter(Boolean));
    return w;
  }, "authorization");
  const give = useAction(async () => {
    if (!who) return;
    const expires = expiryForPreset(preset, date);
    const body = {
      workspace_id: who.id,
      action_scopes: scopes,
      service_categories: cats,
      expires_at: expires || null,
      note: note.trim() || null,
    };
    await authApi.grant(id, body, keyForBody(keys.current, body));
    await refresh();
  }, "authorization");

  const lookup = async () => {
    const parsed = parseWorkspaceRef(ref);
    if (!parsed) return setRefError(g.invalidRef);
    setRefError(undefined);
    await find.exec(parsed);
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (scopes.length === 0) e.action_scopes = "Choose at least one thing to allow.";
    if (cats.length === 0) e.service_categories = "Choose at least one area.";
    const exp = expiryProblem(expiryForPreset(preset, date));
    if (exp) e.expires_at = exp;
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await give.exec();
    if (res.ok) setDone(true);
  };

  const scopeChoices = scopeOptions(catalogue.data);
  const catChoices = (catalogue.data?.service_categories ?? []).map((c) => ({
    key: c.key,
    label: c.label,
  }));
  const err = (k: string) => errors[k] ?? give.fields[k];

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: g.title }} />
      <QueryGate queries={[ctx]}>
        {!canApprove ? (
          <Notice>{t.readOnly}</Notice>
        ) : done ? (
          <>
            <Notice tone="success">{t.granted}</Notice>
            <Button label={strings.common.done} onPress={() => router.back()} />
          </>
        ) : !who ? (
          <>
            <Text tone="text2">{g.intro}</Text>
            <TextField
              label={g.ref}
              value={ref}
              onChangeText={(v) => {
                setRef(v);
                setRefError(undefined);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              error={refError}
            />
            {find.error ? <Notice tone="danger">{find.error}</Notice> : null}
            <Button
              label={find.pending ? g.finding : g.find}
              busy={find.pending}
              onPress={() => void lookup()}
            />
          </>
        ) : (
          <>
            <Card>
              <Text variant="footnote" tone="textMuted">
                {g.confirmWho}
              </Text>
              <Text bold>{who.display_name}</Text>
              <Badge
                label={who.verification_status === "verified" ? t.verified : t.notVerified}
                tone={who.verification_status === "verified" ? "success" : "neutral"}
              />
              <Button label={strings.common.back} variant="link" onPress={() => setWho(null)} />
            </Card>
            <ScopePicker
              label={strings.az.scopesTitle}
              options={scopeChoices}
              value={scopes}
              onChange={setScopes}
              error={err("action_scopes")}
            />
            {catChoices.length > 0 ? (
              <CategoryPicker
                label={strings.az.areasTitle}
                options={catChoices}
                value={cats}
                onChange={setCats}
                error={err("service_categories")}
              />
            ) : (
              <>
                <Text variant="footnote" tone="text2" bold accessibilityRole="header">
                  {strings.az.areasTitle}
                </Text>
                {catalogue.isError ? (
                  <Button
                    label={strings.common.retry}
                    variant="secondary"
                    onPress={() => void catalogue.refetch()}
                  />
                ) : (
                  <Text tone="textMuted">{strings.common.loading}</Text>
                )}
                {err("service_categories") ? (
                  <Notice tone="danger">{err("service_categories")}</Notice>
                ) : null}
              </>
            )}
            <ExpiryPicker
              preset={preset}
              onPreset={setPreset}
              date={date}
              onDate={setDate}
              error={err("expires_at")}
            />
            <TextField
              label={t.allowNote}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={2000}
            />
            {give.error ? <Notice tone="danger">{give.error}</Notice> : null}
            <Button label={g.give} busy={give.pending} onPress={() => void submit()} />
          </>
        )}
      </QueryGate>
      <AuthNote />
    </Screen>
  );
}
