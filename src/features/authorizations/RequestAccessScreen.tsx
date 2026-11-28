import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useRef, useState } from "react";
import { AuthNote, CategoryPicker, ExpiryPicker, ScopePicker } from "./parts";
import { useWorkspaceId } from "@/features/workspace/useWorkspaceId";
import {
  authApi,
  keyForBody,
  useCatalogue,
  useRefreshClients,
  useWorkspaceClients,
} from "@/lib/api/authorizations";
import { useWsContext } from "@/lib/api/workspaces";
import {
  WS_AUTH_PERM,
  expiryForPreset,
  inOrder,
  requestBody,
  requestProblems,
  scopeOptions,
  toggleScope,
  type AuthorizationCatalogue,
  type ExpiryPreset,
} from "@/lib/authorizations";
import { useAction } from "@/lib/useAction";
import { can } from "@/lib/workspace";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.az.request;

/**
 * Request access to a company, or ask for more on an active one (M27). What to
 * do, areas, how long and a note; the company decides, so nothing is shared yet.
 */
export function RequestAccessScreen() {
  const id = useWorkspaceId();
  const { companyId, name, expand } = useLocalSearchParams<{
    companyId: string;
    name?: string;
    expand?: string;
  }>();
  const ctx = useWsContext(id);
  const catalogue = useCatalogue();
  const clients = useWorkspaceClients(id);
  const canRequest = can(ctx.data?.permissions, WS_AUTH_PERM.request);
  const expanding = expand === "1";
  const current = (clients.data ?? []).find((c) => c.company.id === companyId)?.authorization;
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: expanding ? t.expandTitle : t.title }} />
      <QueryGate queries={[ctx, catalogue, clients]}>
        {!canRequest ? (
          <Notice>{strings.az.clients.canRequestOnly}</Notice>
        ) : catalogue.data ? (
          <Form
            workspaceId={id}
            companyId={companyId ?? ""}
            name={name ?? ""}
            catalogue={catalogue.data}
            expanding={expanding}
            existingScopes={current?.action_scopes}
            existingCategories={current?.service_categories}
          />
        ) : null}
      </QueryGate>
      <AuthNote />
    </Screen>
  );
}

function Form({
  workspaceId,
  companyId,
  name,
  catalogue,
  expanding,
  existingScopes,
  existingCategories,
}: {
  workspaceId: string;
  companyId: string;
  name: string;
  catalogue: AuthorizationCatalogue;
  expanding: boolean;
  existingScopes?: string[];
  existingCategories?: string[];
}) {
  const router = useRouter();
  const refresh = useRefreshClients(workspaceId);
  const keys = useRef(new Map<string, string>());
  const options = scopeOptions(catalogue);
  const [scopes, setScopes] = useState<string[]>(() =>
    expanding && existingScopes?.length
      ? inOrder(toggleScope(existingScopes, "company_profile.update", true, options), options)
      : ["company_profile.read"],
  );
  const [cats, setCats] = useState<string[]>(() =>
    expanding && existingCategories?.length
      ? [...existingCategories]
      : catalogue.service_categories.some((c) => c.key === "cac")
        ? ["cac"]
        : [],
  );
  const [preset, setPreset] = useState<ExpiryPreset>("none");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const send = useAction(async () => {
    const body = requestBody({
      companyId,
      scopes,
      categories: cats,
      expiresOn: expiryForPreset(preset, date),
      note,
    });
    await authApi.request(workspaceId, body, keyForBody(keys.current, body));
    await refresh();
  }, "authorization");

  const submit = async () => {
    const e = requestProblems({
      scopes,
      categories: cats,
      expiresOn: expiryForPreset(preset, date),
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await send.exec();
    if (res.ok) setSent(true);
  };

  if (sent) {
    return (
      <>
        <Text variant="title2" bold accessibilityRole="header">
          {t.sentTitle}
        </Text>
        <Notice tone="success">{t.sentBody}</Notice>
        <Button
          label={t.toRequests}
          onPress={() => router.replace(`/w/${workspaceId}/clients?tab=requests` as Href)}
        />
        <Button label={t.done} variant="link" onPress={() => router.back()} />
      </>
    );
  }

  const err = (k: string) => errors[k] ?? send.fields[k];
  return (
    <>
      <Text variant="title2" bold accessibilityRole="header">
        {t.forCompany(name)}
      </Text>
      <Text tone="text2">{expanding ? t.expandIntro : t.intro}</Text>
      <ScopePicker
        label={t.scopes}
        options={options}
        value={scopes}
        onChange={setScopes}
        error={err("action_scopes")}
      />
      <CategoryPicker
        label={t.areas}
        options={catalogue.service_categories}
        value={cats}
        onChange={setCats}
        error={err("service_categories")}
      />
      <ExpiryPicker
        preset={preset}
        onPreset={setPreset}
        date={date}
        onDate={setDate}
        error={err("expires_at")}
      />
      <TextField
        label={t.message}
        hint={t.messageHint}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={1000}
      />
      {send.error ? <Notice tone="danger">{send.error}</Notice> : null}
      <Button
        label={send.pending ? t.sending : t.send}
        busy={send.pending}
        onPress={() => void submit()}
      />
    </>
  );
}
