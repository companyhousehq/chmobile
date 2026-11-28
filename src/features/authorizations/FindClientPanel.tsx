import { useRouter, type Href } from "expo-router";
import { useRef, useState } from "react";
import { AuthNote } from "./parts";
import { authApi, keyForBody } from "@/lib/api/authorizations";
import { useMe } from "@/lib/api/queries";
import {
  ENTITY_TYPES,
  companyEntityLabel,
  previewIdentifier,
  resolveBody,
  validateResolve,
  type CompanySummary,
  type ResolveInput,
  type ResolveResult,
} from "@/lib/company";
import { useAction } from "@/lib/useAction";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chips } from "@/ui/Chips";
import { Notice } from "@/ui/Notice";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.az.clients;

/**
 * Find a company to ask for access (M27). Same look-up outcomes as claiming:
 * matched, possible duplicate, or a new record. Finding gives no access.
 */
export function FindClientPanel({
  workspaceId,
  canRequest,
}: {
  workspaceId: string;
  canRequest: boolean;
}) {
  const router = useRouter();
  const me = useMe();
  const keys = useRef(new Map<string, string>());
  const [input, setInput] = useState<ResolveInput>({
    legalName: "",
    entityType: "company",
    jurisdiction: "NG",
    authority: "CAC",
    identifier: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ResolveResult | null>(null);

  const set = <K extends keyof ResolveInput>(k: K, v: ResolveInput[K]) => {
    setErrors({});
    setInput((i) => ({ ...i, [k]: v }));
  };

  const resolve = useAction(async (body: ResolveInput) => {
    const key = keyForBody(keys.current, resolveBody(body));
    return authApi.wsResolve(workspaceId, body, key);
  }, "authorization");

  const search = async (confirmDistinct = false) => {
    const e = validateResolve(input);
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await resolve.exec({ ...input, confirmDistinct });
    if (res.ok) setResult(res.value);
  };

  const request = (c: CompanySummary) =>
    router.push(
      `/w/${workspaceId}/request-access?companyId=${c.id}&name=${encodeURIComponent(c.legal_name)}` as Href,
    );

  const unverified = me.data && !me.data.email_verified;
  const preview = previewIdentifier(input.entityType, input.authority, input.identifier);

  if (result) {
    const candidates =
      result.outcome === "possible_duplicate"
        ? (result.candidates ?? [])
        : result.company
          ? [result.company]
          : [];
    return (
      <>
        <Text variant="title2" bold accessibilityRole="header">
          {result.outcome === "possible_duplicate"
            ? t.duplicate
            : companyEntityLabel(input.entityType)}
        </Text>
        {result.outcome === "possible_duplicate" ? (
          <Text tone="text2">{t.duplicateBody}</Text>
        ) : null}
        {result.outcome === "created_provisional" ? <Notice>{t.createdBody}</Notice> : null}
        {result.outcome === "matched_unverified" ? <Notice>{t.unverifiedNote}</Notice> : null}
        {candidates.map((c) => (
          <CompanyResultCard
            key={c.id}
            c={c}
            canRequest={canRequest && result.outcome !== "created_provisional"}
            onRequest={() => request(c)}
          />
        ))}
        {result.outcome === "possible_duplicate" ? (
          <Button
            label={t.different}
            variant="secondary"
            busy={resolve.pending}
            onPress={() => void search(true)}
          />
        ) : null}
        {resolve.error ? <Notice tone="danger">{resolve.error}</Notice> : null}
        <Notice>{strings.az.noAccessUntil}</Notice>
        <Button label={t.reset} variant="link" onPress={() => setResult(null)} />
        <AuthNote />
      </>
    );
  }

  return (
    <>
      <Text tone="text2">{t.findIntro}</Text>
      {unverified ? <Notice tone="warning">{t.emailUnverified}</Notice> : null}
      <Text variant="footnote" tone="text2" bold>
        {t.entity}
      </Text>
      <Chips
        label={t.entity}
        value={input.entityType}
        onChange={(v) => {
          set("entityType", v);
          if (v === "other" && input.authority === "CAC") set("authority", "");
          if (v !== "other" && input.authority === "") set("authority", "CAC");
        }}
        options={ENTITY_TYPES.map((e) => ({
          value: e.value,
          label: e.prefix ? `${e.label} (${e.prefix})` : e.label,
        }))}
      />
      <TextField
        label={t.identifier}
        hint={preview?.ok ? preview.display : t.identifierHint}
        value={input.identifier}
        onChangeText={(v) => set("identifier", v)}
        autoCapitalize="characters"
        autoCorrect={false}
        error={errors.identifier}
      />
      <TextField
        label={t.legalName}
        value={input.legalName}
        onChangeText={(v) => set("legalName", v)}
        autoCapitalize="words"
        maxLength={200}
        error={errors.legal_name}
      />
      {resolve.error ? <Notice tone="danger">{resolve.error}</Notice> : null}
      <Button
        label={resolve.pending ? t.searching : t.search2}
        busy={resolve.pending}
        disabled={!!unverified}
        onPress={() => void search()}
      />
    </>
  );
}

function CompanyResultCard({
  c,
  canRequest,
  onRequest,
}: {
  c: CompanySummary;
  canRequest: boolean;
  onRequest: () => void;
}) {
  const verified =
    c.primary_identifier?.verification_status === "verified" ||
    c.verification_status === "verified";
  return (
    <Card>
      <Text bold>{c.legal_name}</Text>
      <Text variant="footnote" tone="text2">
        {companyEntityLabel(c.entity_type)}
        {c.primary_identifier ? ` · ${c.primary_identifier.identifier_display}` : ""}
      </Text>
      <Badge label={verified ? t.verified : t.unverified} tone={verified ? "success" : "neutral"} />
      {canRequest ? <Button label={t.requestAccess} onPress={onRequest} /> : null}
    </Card>
  );
}
