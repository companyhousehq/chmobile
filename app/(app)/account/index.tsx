import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { resendVerification, updateMe } from "@/lib/api/auth";
import { keys, useMe } from "@/lib/api/queries";
import type { Account as AccountData } from "@/lib/types";
import { useAction } from "@/lib/useAction";
import { normalizePhone } from "@/lib/validation";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

/** Account details (spec 0012 M4): name and phone, email status, links to change email and password. */
export default function Account() {
  const me = useMe();
  if (!me.data) {
    return (
      <Screen edges={["bottom"]}>
        <Stack.Screen options={{ title: strings.account.title }} />
        {me.isError ? <Notice tone="danger">{strings.common.offline}</Notice> : null}
      </Screen>
    );
  }
  return <AccountForm a={me.data} />;
}

function AccountForm({ a }: { a: AccountData }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(a.full_name);
  const [phone, setPhone] = useState(a.phone ?? "");
  const [local, setLocal] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [resent, setResent] = useState(false);
  const save = useAction(updateMe);
  const resend = useAction(resendVerification);
  const submit = async () => {
    setSaved(false);
    if (!fullName.trim()) {
      setLocal("Enter your full name.");
      return;
    }
    setLocal(undefined);
    const body: { full_name?: string; phone?: string | null } = {};
    if (fullName.trim() !== a.full_name) body.full_name = fullName.trim();
    const nextPhone = phone.trim() ? normalizePhone(phone) : null;
    if (nextPhone !== (a.phone ?? null)) body.phone = nextPhone;
    if (Object.keys(body).length === 0) {
      setSaved(true);
      return;
    }
    const res = await save.run(body);
    if (res) {
      qc.setQueryData(keys.me, res);
      setSaved(true);
    }
  };

  const doResend = async () => {
    const res = await resend.run();
    setResent(!!res);
  };

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: strings.account.title }} />
      {save.error ? <Notice tone="danger">{save.error}</Notice> : null}
      {saved ? <Notice tone="success">{strings.account.saved}</Notice> : null}
      <TextField
        label={strings.account.fullName}
        value={fullName}
        onChangeText={setFullName}
        error={local ?? save.fields.full_name}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
      />
      <TextField
        label={strings.account.phone}
        hint={strings.signup.phoneHint}
        value={phone}
        onChangeText={setPhone}
        error={save.fields.phone}
        autoComplete="tel"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
      />
      <Button label={strings.account.update} busy={save.pending} onPress={() => void submit()} />

      <Text variant="footnote" tone="textMuted" bold accessibilityRole="header">
        {strings.account.email}
      </Text>
      <Row
        title={a.email}
        hint={
          a.email_verified
            ? strings.account.emailStatusVerified
            : strings.account.emailStatusUnverified
        }
      />
      {a.pending_email_change ? (
        <Notice tone="info">
          {strings.account.emailPending(a.pending_email_change.new_email)}
        </Notice>
      ) : null}
      {!a.email_verified ? (
        <>
          {resent ? <Notice tone="success">{strings.account.resent}</Notice> : null}
          {resend.error ? <Notice tone="danger">{resend.error}</Notice> : null}
          <Button
            label={strings.account.resend}
            variant="secondary"
            busy={resend.pending}
            onPress={() => void doResend()}
          />
        </>
      ) : null}
      <Row title={strings.account.changeEmail} onPress={() => router.push("/account/email")} />
      <Row
        title={strings.account.changePassword}
        onPress={() => router.push("/account/password")}
      />
    </Screen>
  );
}
