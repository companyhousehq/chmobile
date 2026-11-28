import { Stack } from "expo-router";
import { useState } from "react";
import { useWorkspaceId } from "./useWorkspaceId";
import { useRefreshWorkspace, useWorkspace, useWsContext, wsApi } from "@/lib/api/workspaces";
import { useAction } from "@/lib/useAction";
import { normalizePhone, isEmail } from "@/lib/validation";
import {
  ENTITY_TYPES,
  LEGAL_PROFILE_OPTIONS,
  PERM,
  can,
  draftFromWorkspace,
  identityLocked,
  profilePatch,
  verificationMeta,
  type ProfileDraft,
  type Workspace,
} from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Chips } from "@/ui/Chips";
import { IndependenceNotice } from "@/ui/IndependenceNotice";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.ws.profile;

/** View and edit the workspace profile for holders of workspace.profile.update (M9). */
export function ProfileScreen() {
  const id = useWorkspaceId();
  const workspace = useWorkspace(id);
  const ctx = useWsContext(id);
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.title }} />
      <QueryGate queries={[workspace, ctx]}>
        {workspace.data ? (
          <ProfileForm
            workspace={workspace.data}
            canEdit={can(ctx.data?.permissions, PERM.profileUpdate)}
          />
        ) : null}
      </QueryGate>
    </Screen>
  );
}

function ProfileForm({ workspace, canEdit }: { workspace: Workspace; canEdit: boolean }) {
  const refresh = useRefreshWorkspace(workspace.id);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromWorkspace(workspace));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const locked = identityLocked(workspace.verification_status);
  const v = verificationMeta(workspace.verification_status);
  const save = useAction(async () => {
    const out = await wsApi.update(
      workspace.id,
      profilePatch(workspace, draft, normalizePhone(draft.contactPhone)),
    );
    await refresh();
    return out;
  }, "workspace-profile");

  const set = <K extends keyof ProfileDraft>(k: K, value: ProfileDraft[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [k]: value }));
  };
  const editable = canEdit;
  const idEditable = editable && !locked;
  const err = (api: string, local?: string) => local ?? save.fields[api];

  const submit = async () => {
    setSaved(false);
    const e: Record<string, string> = {};
    if (!draft.displayName.trim()) e.display_name = "Enter a name for the workspace.";
    if (draft.contactEmail.trim() && !isEmail(draft.contactEmail.trim())) {
      e.contact_email = "Enter a valid email address, like office@agency.ng.";
    }
    setLocalErrors(e);
    if (Object.keys(e).length) return;
    const res = await save.exec();
    if (res.ok) setSaved(true);
  };

  return (
    <>
      <Badge label={v.label} tone={v.tone} />
      <IndependenceNotice />
      {!editable ? <Notice>{t.readOnly}</Notice> : null}
      {locked ? <Notice tone="warning">{t.locked}</Notice> : null}
      <TextField
        label={t.name}
        value={draft.displayName}
        onChangeText={(x) => set("displayName", x)}
        editable={idEditable}
        error={err("display_name", localErrors.display_name)}
        maxLength={200}
      />
      <Text variant="footnote" tone="text2" bold>
        {t.legal}
      </Text>
      {idEditable ? (
        <Chips
          label={t.legal}
          value={draft.legal}
          onChange={(x) => set("legal", x)}
          options={LEGAL_PROFILE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      ) : (
        <Text>
          {LEGAL_PROFILE_OPTIONS.find((o) => o.value === draft.legal)?.label ?? draft.legal}
        </Text>
      )}
      {draft.legal === "registered_business" ? (
        <>
          {idEditable ? (
            <Chips
              label={t.entity}
              value={draft.entityType}
              onChange={(x) => set("entityType", x)}
              options={ENTITY_TYPES.map((o) => ({
                value: o.value,
                label: `${o.label} (${o.prefix})`,
              }))}
            />
          ) : null}
          <TextField
            label={t.cac}
            hint={t.cacHint}
            value={draft.identifier}
            onChangeText={(x) => set("identifier", x)}
            editable={idEditable}
            autoCapitalize="characters"
            autoCorrect={false}
            error={err("registration_identifier")}
          />
        </>
      ) : null}
      <TextField
        label={t.email}
        value={draft.contactEmail}
        onChangeText={(x) => set("contactEmail", x)}
        editable={editable}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={err("contact_email", localErrors.contact_email)}
      />
      <TextField
        label={t.phone}
        value={draft.contactPhone}
        onChangeText={(x) => set("contactPhone", x)}
        editable={editable}
        keyboardType="phone-pad"
        error={err("contact_phone")}
      />
      <TextField
        label={t.line1}
        value={draft.line1}
        onChangeText={(x) => set("line1", x)}
        editable={editable}
      />
      <TextField
        label={t.line2}
        value={draft.line2}
        onChangeText={(x) => set("line2", x)}
        editable={editable}
      />
      <TextField
        label={t.city}
        value={draft.city}
        onChangeText={(x) => set("city", x)}
        editable={editable}
      />
      <TextField
        label={t.state}
        value={draft.state}
        onChangeText={(x) => set("state", x)}
        editable={editable}
      />
      {save.error ? <Notice tone="danger">{save.error}</Notice> : null}
      {saved ? <Notice tone="success">{strings.common.saved}</Notice> : null}
      {editable ? (
        <Button label={strings.common.save} busy={save.pending} onPress={() => void submit()} />
      ) : null}
    </>
  );
}
