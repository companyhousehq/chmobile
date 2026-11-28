import { Stack, useRouter, type Href } from "expo-router";
import { useRef, useState } from "react";
import { companyApi } from "@/lib/api/companies";
import { newKey } from "@/lib/api/claimFlow";
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
import { IndependenceNotice } from "@/ui/IndependenceNotice";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.co.find;

const previewText = (entity: string, authority: string, raw: string): string | null => {
  const p = previewIdentifier(entity, authority, raw);
  if (!p) return null;
  if (p.ok) return t.preview(p.display);
  const [kind, arg = ""] = p.reason.split(":");
  switch (kind) {
    case "prefix":
      return t.previewBad.prefix(arg);
    case "digits":
      return t.previewBad.digits(arg);
    case "type":
      return t.previewBad.type;
    case "length":
      return t.previewBad.length;
    default:
      return t.previewBad.chars;
  }
};

/**
 * Find your company: a step form that walks all four outcomes (M16). Every
 * result says that finding a company gives no access and that Company House
 * is not CAC.
 */
export function FindCompanyScreen() {
  const router = useRouter();
  const me = useMe();
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<ResolveInput>({
    legalName: "",
    entityType: "company",
    jurisdiction: "NG",
    authority: "CAC",
    identifier: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ResolveResult | null>(null);
  const keys = useRef(new Map<string, string>());

  const set = <K extends keyof ResolveInput>(k: K, v: ResolveInput[K]) => {
    setErrors({});
    setInput((i) => ({ ...i, [k]: v }));
  };

  const resolve = useAction(async (body: ResolveInput) => {
    // The same details resend the same Idempotency-Key, so a retry never creates two records.
    const sig = JSON.stringify(resolveBody(body));
    let key = keys.current.get(sig);
    if (!key) {
      key = newKey();
      keys.current.set(sig, key);
    }
    return companyApi.resolve(body, key);
  }, "generic");

  const search = async (confirmDistinct = false) => {
    const e = validateResolve(input);
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await resolve.exec({ ...input, confirmDistinct });
    if (res.ok) setResult(res.value);
  };

  const claim = (c: CompanySummary) =>
    router.push(`/companies/claim/${c.id}?name=${encodeURIComponent(c.legal_name)}` as Href);

  const unverifiedEmail = me.data && !me.data.email_verified;

  if (result) {
    return (
      <Screen edges={["bottom"]}>
        <Stack.Screen options={{ title: t.title }} />
        <Result
          result={result}
          onClaim={claim}
          onDifferent={() => void search(true)}
          busy={resolve.pending}
        />
        {resolve.error ? <Notice tone="danger">{resolve.error}</Notice> : null}
        <Notice>{strings.co.noAccessNote}</Notice>
        <IndependenceNotice />
        <Button
          label={t.again}
          variant="secondary"
          onPress={() => {
            setResult(null);
            setStep(0);
          }}
        />
      </Screen>
    );
  }

  const preview = previewText(input.entityType, input.authority, input.identifier);
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.title }} />
      <Text variant="title2" bold accessibilityRole="header">
        {t.title}
      </Text>
      <Text tone="text2">{t.intro}</Text>
      <Notice>{strings.co.noAccessNote}</Notice>
      <IndependenceNotice />
      {unverifiedEmail ? <Notice tone="warning">{t.emailUnverified}</Notice> : null}
      {step === 0 ? (
        <>
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
            label={t.jurisdiction}
            value={input.jurisdiction}
            onChangeText={(v) => set("jurisdiction", v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={2}
          />
          <TextField
            label={t.authority}
            hint={t.authorityHint}
            value={input.authority}
            onChangeText={(v) => set("authority", v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={32}
          />
          <Button label={strings.common.continue} onPress={() => setStep(1)} />
        </>
      ) : (
        <>
          <Text variant="footnote" tone="textMuted">
            {companyEntityLabel(input.entityType)}
            {input.authority ? ` · ${input.authority}` : ""} · {input.jurisdiction}
          </Text>
          <TextField
            label={t.identifier}
            hint={preview ?? t.identifierHint}
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
            error={errors.legal_name}
            autoCapitalize="words"
            maxLength={200}
          />
          {resolve.error ? <Notice tone="danger">{resolve.error}</Notice> : null}
          <Button
            label={resolve.pending ? t.searching : t.search}
            busy={resolve.pending}
            disabled={!!unverifiedEmail}
            onPress={() => void search()}
          />
          <Button label={strings.common.back} variant="link" onPress={() => setStep(0)} />
        </>
      )}
    </Screen>
  );
}

function CompanyCard({ c, onClaim }: { c: CompanySummary; onClaim: (c: CompanySummary) => void }) {
  const verified =
    c.primary_identifier?.verification_status === "verified" ||
    c.verification_status === "verified";
  return (
    <Card>
      <Text bold>{c.legal_name}</Text>
      <Text variant="footnote" tone="text2">
        {companyEntityLabel(c.entity_type)}
        {c.primary_identifier ? ` · ${t.identifier2(c.primary_identifier.identifier_display)}` : ""}
      </Text>
      <Badge label={verified ? t.verified : t.unverified} tone={verified ? "success" : "neutral"} />
      <Button label={t.mine} onPress={() => onClaim(c)} />
    </Card>
  );
}

function Result({
  result,
  onClaim,
  onDifferent,
  busy,
}: {
  result: ResolveResult;
  onClaim: (c: CompanySummary) => void;
  onDifferent: () => void;
  busy: boolean;
}) {
  if (result.outcome === "possible_duplicate") {
    return (
      <>
        <Text variant="title2" bold accessibilityRole="header">
          {t.duplicate}
        </Text>
        <Text tone="text2">{t.duplicateBody}</Text>
        {(result.candidates ?? []).map((c) => (
          <CompanyCard key={c.id} c={c} onClaim={onClaim} />
        ))}
        <Notice>{t.differentConfirm}</Notice>
        <Button label={t.different} variant="secondary" busy={busy} onPress={onDifferent} />
      </>
    );
  }
  const created = result.outcome === "created_provisional";
  return (
    <>
      <Text variant="title2" bold accessibilityRole="header">
        {created ? t.created : t.matchedVerified}
      </Text>
      {created ? <Text tone="text2">{t.createdBody}</Text> : null}
      {result.outcome === "matched_unverified" ? (
        <Text tone="text2">{t.unverifiedNote}</Text>
      ) : null}
      {result.company ? <CompanyCard c={result.company} onClaim={onClaim} /> : null}
    </>
  );
}
