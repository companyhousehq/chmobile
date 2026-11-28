import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { AccessBadges, AuthNote, SectionLabel } from "./parts";
import { useWorkspaceId } from "@/features/workspace/useWorkspaceId";
import { ApiError } from "@/lib/api/client";
import { authApi, useCatalogue, useClientHome, useDropClient } from "@/lib/api/authorizations";
import { useMe } from "@/lib/api/queries";
import { useWsContext } from "@/lib/api/workspaces";
import { WS_AUTH_PERM, accessDuration, canEditClient, type ClientHome } from "@/lib/authorizations";
import {
  companyEntityLabel,
  isIsoDateText,
  profileBody,
  profileChanged,
  profileDraft,
  type CompanyProfileDraft,
} from "@/lib/company";
import { useAction } from "@/lib/useAction";
import { isEmail, normalizePhone } from "@/lib/validation";
import { can, formatDate } from "@/lib/workspace";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { confirm } from "@/ui/confirm";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";
import { useQueryClient } from "@tanstack/react-query";

const t = strings.az.client;
const tp = strings.co.profile;

/**
 * Client view (M28): what this workspace's access allows, the declared profile
 * and business activities. Editing appears only when the access allows it and
 * the member may update clients. A 404 means access is gone (AC40).
 */
export function ClientViewScreen() {
  const id = useWorkspaceId();
  const { companyId } = useLocalSearchParams<{ companyId: string }>();
  const cid = companyId ?? "";
  const router = useRouter();
  const ctx = useWsContext(id);
  const home = useClientHome(id, cid);
  const catalogue = useCatalogue();
  const drop = useDropClient(id);
  const handled = useRef(false);
  const gone = home.error instanceof ApiError && home.error.status === 404;

  useEffect(() => {
    if (!gone || handled.current) return;
    handled.current = true;
    void drop(cid);
    Alert.alert(t.gone.title, t.gone.body);
    router.replace(`/w/${id}/clients` as Href);
  }, [gone, drop, cid, id, router]);

  const perms = ctx.data?.permissions ?? [];
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.title }} />
      <QueryGate queries={gone ? [ctx] : [ctx, home]}>
        {home.data ? (
          <Body
            workspaceId={id}
            home={home.data}
            catalogue={catalogue.data}
            canRequest={can(perms, WS_AUTH_PERM.request)}
            canUpdate={can(perms, WS_AUTH_PERM.clientsUpdate)}
          />
        ) : null}
      </QueryGate>
      <AuthNote />
    </Screen>
  );
}

function Body({
  workspaceId,
  home,
  catalogue,
  canRequest,
  canUpdate,
}: {
  workspaceId: string;
  home: ClientHome;
  catalogue: ReturnType<typeof useCatalogue>["data"];
  canRequest: boolean;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const drop = useDropClient(workspaceId);
  const [stopping, setStopping] = useState(false);
  const [reason, setReason] = useState("");
  const { company, authorization: auth } = home;
  const canEdit = canUpdate && canEditClient(auth.action_scopes);
  const canReadProfile = auth.action_scopes.includes("company_profile.read");

  const stop = useAction(async () => {
    await authApi.relinquish(workspaceId, auth.id, reason);
    await drop(company.id);
  }, "authorization");

  const confirmStop = async () => {
    if (!(await confirm(t.stopTitle, t.stopBody(company.legal_name), strings.az.client.stop)))
      return;
    const res = await stop.exec();
    if (res.ok) {
      Alert.alert(t.stopDone);
      router.replace(`/w/${workspaceId}/clients` as Href);
    }
  };

  return (
    <>
      <Text variant="title2" bold accessibilityRole="header">
        {company.legal_name}
      </Text>
      <Text tone="text2">
        {companyEntityLabel(company.entity_type)} · {company.jurisdiction}
      </Text>
      {company.identifiers.map((i) => (
        <Text
          key={`${i.registration_authority}:${i.identifier_display}`}
          variant="footnote"
          tone="textMuted"
        >
          {`${i.registration_authority} ${i.identifier_display}`}
        </Text>
      ))}

      <Card>
        <SectionLabel>{t.banner}</SectionLabel>
        <Text variant="footnote" tone="text2">
          {t.bannerNote}
        </Text>
        <Text variant="footnote" tone="textMuted">
          {t.canDo}
        </Text>
        <AccessBadges
          scopes={auth.action_scopes}
          categories={auth.service_categories}
          catalogue={catalogue}
        />
        <Text variant="footnote" tone="textMuted">
          {`${t.duration}: ${accessDuration(auth.expires_at)}`}
        </Text>
        {!canEditClient(auth.action_scopes) ? <Text variant="footnote">{t.viewOnly}</Text> : null}
        {canEditClient(auth.action_scopes) && !canUpdate ? (
          <Text variant="footnote">{t.noEditRole}</Text>
        ) : null}
      </Card>

      {canReadProfile ? (
        <>
          <ProfileForm workspaceId={workspaceId} home={home} canEdit={canEdit} />
          <Row
            title={t.activity}
            hint={
              home.activity_profile.current_version
                ? undefined
                : home.activity_profile.status === "draft"
                  ? t.activityDraft
                  : t.activityNone
            }
            onPress={() => router.push(`/w/${workspaceId}/client/${company.id}/activity` as Href)}
          />
        </>
      ) : null}

      {canRequest ? (
        <>
          <Button
            label={t.moreAccess}
            variant="secondary"
            onPress={() =>
              router.push(
                `/w/${workspaceId}/request-access?companyId=${company.id}&name=${encodeURIComponent(company.legal_name)}&expand=1` as Href,
              )
            }
          />
          {stopping ? (
            <>
              <TextField
                label={t.stopReason}
                value={reason}
                onChangeText={setReason}
                multiline
                maxLength={2000}
              />
              {stop.error ? <Notice tone="danger">{stop.error}</Notice> : null}
              <Button
                label={t.stop}
                destructive
                busy={stop.pending}
                onPress={() => void confirmStop()}
              />
              <Button
                label={strings.common.cancel}
                variant="link"
                disabled={stop.pending}
                onPress={() => setStopping(false)}
              />
            </>
          ) : (
            <Button
              label={t.stop}
              variant="secondary"
              destructive
              onPress={() => setStopping(true)}
            />
          )}
        </>
      ) : null}
    </>
  );
}

function ProfileForm({
  workspaceId,
  home,
  canEdit,
}: {
  workspaceId: string;
  home: ClientHome;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const userId = useMe().data?.id ?? "";
  const p = home.profile;
  const [draft, setDraft] = useState<CompanyProfileDraft>(() => profileDraft(p));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const save = useAction(async () => {
    const out = await authApi.clientUpdateProfile(
      workspaceId,
      home.company.id,
      profileBody(p.version, { ...draft, phone: normalizePhone(draft.phone) }),
    );
    await qc.invalidateQueries({
      queryKey: ["u", userId, "ws", workspaceId, "client", home.company.id],
    });
    return out;
  }, "company");

  const set = <K extends keyof CompanyProfileDraft>(k: K, v: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [k]: v }));
  };
  const submit = async () => {
    setSaved(false);
    const e: Record<string, string> = {};
    if (draft.incorporationDate.trim() && !isIsoDateText(draft.incorporationDate)) {
      e.incorporation_date = tp.badDate;
    }
    if (draft.email.trim() && !isEmail(draft.email.trim())) e.contact_email = tp.badEmail;
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await save.exec();
    if (res.ok) setSaved(true);
  };
  const err = (k: string) => errors[k] ?? save.fields[k];

  return (
    <>
      <SectionLabel>{t.declared}</SectionLabel>
      <Text variant="footnote" tone="text2">
        {t.declaredNote}
      </Text>
      <TextField
        label={tp.address}
        value={draft.address}
        onChangeText={(v) => set("address", v)}
        editable={canEdit}
        multiline
        error={err("registered_address")}
      />
      <TextField
        label={tp.incorporation}
        hint={tp.incorporationHint}
        value={draft.incorporationDate}
        onChangeText={(v) => set("incorporationDate", v)}
        editable={canEdit}
        keyboardType="numbers-and-punctuation"
        error={err("incorporation_date")}
      />
      <TextField
        label={tp.email}
        value={draft.email}
        onChangeText={(v) => set("email", v)}
        editable={canEdit}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={err("contact_email")}
      />
      <TextField
        label={tp.phone}
        value={draft.phone}
        onChangeText={(v) => set("phone", v)}
        editable={canEdit}
        keyboardType="phone-pad"
        error={err("contact_phone")}
      />
      <TextField
        label={tp.website}
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
          {t.editedBy(p.saved_by.full_name, formatDate(p.saved_at))}
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
