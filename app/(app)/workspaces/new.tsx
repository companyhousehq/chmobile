import { useRouter, type Href } from "expo-router";
import * as Crypto from "expo-crypto";
import { useRef, useState } from "react";
import { useMe, useContextLists } from "@/lib/api/queries";
import { useRefreshMyWorkspaces, wsApi } from "@/lib/api/workspaces";
import { useAction } from "@/lib/useAction";
import {
  ENTITY_TYPES,
  LEGAL_PROFILE_OPTIONS,
  createWorkspaceBody,
  validateCreateWorkspace,
} from "@/lib/workspace";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Chips } from "@/ui/Chips";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.ws.create;

/** Create a personal or agency workspace (0001; verified email only, the API enforces it). */
export default function NewWorkspace() {
  const router = useRouter();
  const me = useMe();
  const lists = useContextLists(me.data?.id);
  const refresh = useRefreshMyWorkspaces();
  const hasPersonal = (lists.data?.workspaces ?? []).some((w) => w.workspace.type === "personal");
  const [type, setType] = useState<"personal" | "agency">("agency");
  const [name, setName] = useState("");
  const [legal, setLegal] = useState("registered_business");
  const [entityType, setEntityType] = useState("company");
  const [identifier, setIdentifier] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const key = useRef(Crypto.randomUUID());

  const input = { type, displayName: name, legal, entityType, identifier };
  const create = useAction(async () => {
    const ws = await wsApi.create(createWorkspaceBody(input), key.current);
    await refresh();
    return ws;
  }, "workspace-create");

  const choose = (v: "personal" | "agency") => {
    setType(v);
    setLegal(v === "agency" ? "registered_business" : "individual");
    if (v === "personal" && !name.trim() && me.data) setName(me.data.full_name);
  };

  const submit = async () => {
    const e = validateCreateWorkspace(input);
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await create.exec();
    if (res.ok) router.replace(`/w/${res.value.id}` as Href);
  };

  return (
    <Screen edges={["bottom"]}>
      {me.data && !me.data.email_verified ? <Notice tone="warning">{t.verifyEmail}</Notice> : null}
      <Text variant="footnote" tone="text2" bold>
        {t.how}
      </Text>
      <Chips
        label={t.how}
        value={type}
        onChange={choose}
        options={[
          { value: "agency", label: t.agency },
          ...(hasPersonal ? [] : [{ value: "personal" as const, label: t.personal }]),
        ]}
      />
      <Text variant="footnote" tone="textMuted">
        {type === "agency" ? t.agencyHint : t.personalHint}
      </Text>
      {hasPersonal ? (
        <Text variant="footnote" tone="textMuted">
          {t.personalExists}
        </Text>
      ) : null}
      <TextField
        label={type === "agency" ? t.agencyName : t.personalName}
        value={name}
        onChangeText={setName}
        maxLength={200}
        error={errors.display_name ?? create.fields.display_name}
      />
      <Text variant="footnote" tone="text2" bold>
        {t.legal}
      </Text>
      <Chips
        label={t.legal}
        value={legal}
        onChange={setLegal}
        options={LEGAL_PROFILE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      />
      {legal === "registered_business" ? (
        <>
          <Chips
            label={strings.ws.profile.entity}
            value={entityType}
            onChange={setEntityType}
            options={ENTITY_TYPES.map((o) => ({
              value: o.value,
              label: `${o.label} (${o.prefix})`,
            }))}
          />
          <TextField
            label={strings.ws.profile.cac}
            hint={strings.ws.profile.cacHint}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="characters"
            autoCorrect={false}
            error={create.fields.registration_identifier}
          />
        </>
      ) : null}
      <Notice>{t.note}</Notice>
      {create.error ? <Notice tone="danger">{create.error}</Notice> : null}
      <Button label={t.submit} busy={create.pending} onPress={() => void submit()} />
    </Screen>
  );
}
