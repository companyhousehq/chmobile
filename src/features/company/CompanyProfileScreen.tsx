import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { useCompanyId } from "./useCompanyId";
import {
  companyApi,
  useCompanyContext,
  useCompanyHome,
  useRefreshCompany,
} from "@/lib/api/companies";
import {
  CPERM,
  companyEntityLabel,
  isIsoDateText,
  profileBody,
  profileChanged,
  profileDraft,
  type CompanyHome,
  type CompanyProfileDraft,
} from "@/lib/company";
import { useAction } from "@/lib/useAction";
import { isEmail, normalizePhone } from "@/lib/validation";
import { can, formatDate } from "@/lib/workspace";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.co.profile;

/** Company profile tab: fixed identity read-only, declared profile editable with company.profile.update (M21). */
export function CompanyProfileScreen() {
  const id = useCompanyId();
  const router = useRouter();
  const ctx = useCompanyContext(id);
  const home = useCompanyHome(id);
  return (
    <Screen edges={["bottom"]}>
      <QueryGate queries={[ctx, home]}>
        {home.data ? (
          <ProfileBody
            id={id}
            home={home.data}
            canEdit={can(ctx.data?.permissions, CPERM.profileUpdate)}
          />
        ) : null}
        <Row
          title={strings.co.home.activity}
          hint={strings.co.home.activityHint}
          onPress={() => router.push(`/c/${id}/activity` as Href)}
        />
      </QueryGate>
    </Screen>
  );
}

function ProfileBody({ id, home, canEdit }: { id: string; home: CompanyHome; canEdit: boolean }) {
  const refresh = useRefreshCompany(id);
  const [draft, setDraft] = useState<CompanyProfileDraft>(() => profileDraft(home.profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const save = useAction(async () => {
    const p = await companyApi.updateProfile(
      id,
      profileBody(home.profile.version, { ...draft, phone: normalizePhone(draft.phone) }),
    );
    await refresh();
    return p;
  }, "company");

  const set = <K extends keyof CompanyProfileDraft>(k: K, v: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [k]: v }));
  };

  const submit = async () => {
    setSaved(false);
    const e: Record<string, string> = {};
    if (draft.incorporationDate.trim() && !isIsoDateText(draft.incorporationDate)) {
      e.incorporation_date = t.badDate;
    }
    if (draft.email.trim() && !isEmail(draft.email.trim())) e.contact_email = t.badEmail;
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await save.exec();
    if (res.ok) setSaved(true);
  };

  const p = home.profile;
  const err = (api: string) => errors[api] ?? save.fields[api];
  return (
    <>
      <Text variant="title2" bold accessibilityRole="header">
        {t.title}
      </Text>
      <Card>
        <Text variant="footnote" tone="textMuted" bold>
          {t.fixed}
        </Text>
        <Text variant="footnote" tone="textMuted">
          {t.legalName}
        </Text>
        <Text bold>{home.company.legal_name}</Text>
        <Text variant="footnote" tone="textMuted">
          {t.type}
        </Text>
        <Text>{companyEntityLabel(home.company.entity_type)}</Text>
        <Text variant="footnote" tone="textMuted">
          {t.jurisdiction}
        </Text>
        <Text>{home.company.jurisdiction}</Text>
        {home.company.identifiers.map((i) => (
          <Text key={`${i.registration_authority}:${i.identifier_display}`} tone="text2">
            {`${i.registration_authority} ${i.identifier_display}`}
          </Text>
        ))}
        <Text variant="footnote" tone="textMuted">
          {t.fixedNote}
        </Text>
      </Card>
      <Text variant="footnote" tone="textMuted" bold accessibilityRole="header">
        {t.declaredTitle}
      </Text>
      <Text variant="footnote" tone="text2">
        {t.declaredNote}
      </Text>
      {!canEdit ? <Notice>{t.readOnlyNote}</Notice> : null}
      <TextField
        label={t.address}
        value={draft.address}
        onChangeText={(v) => set("address", v)}
        editable={canEdit}
        multiline
        error={err("registered_address")}
      />
      <TextField
        label={t.incorporation}
        hint={t.incorporationHint}
        value={draft.incorporationDate}
        onChangeText={(v) => set("incorporationDate", v)}
        editable={canEdit}
        keyboardType="numbers-and-punctuation"
        error={err("incorporation_date")}
      />
      <TextField
        label={t.email}
        value={draft.email}
        onChangeText={(v) => set("email", v)}
        editable={canEdit}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={err("contact_email")}
      />
      <TextField
        label={t.phone}
        value={draft.phone}
        onChangeText={(v) => set("phone", v)}
        editable={canEdit}
        keyboardType="phone-pad"
        error={err("contact_phone")}
      />
      <TextField
        label={t.website}
        value={draft.website}
        onChangeText={(v) => set("website", v)}
        editable={canEdit}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        error={err("website")}
      />
      {p.saved_by ? (
        <Text variant="footnote" tone="textMuted">
          {t.savedBy(p.saved_by.full_name, formatDate(p.saved_at))}
        </Text>
      ) : null}
      {save.error ? <Notice tone="danger">{save.error}</Notice> : null}
      {saved ? <Notice tone="success">{strings.common.saved}</Notice> : null}
      {canEdit ? (
        <Button
          label={strings.common.save}
          busy={save.pending}
          disabled={!profileChanged(p, draft)}
          onPress={() => void submit()}
        />
      ) : null}
    </>
  );
}
