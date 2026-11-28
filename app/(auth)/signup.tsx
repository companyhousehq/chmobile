import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { consentDocuments, signup } from "@/lib/api/auth";
import { openLegal } from "@/features/auth/webLinks";
import { checkPassword, isEmail, normalizePhone } from "@/lib/validation";
import { useAction } from "@/lib/useAction";
import { strings } from "@/strings";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

type Errors = Partial<Record<"full_name" | "email" | "password" | "phone" | "terms", string>>;

/** Sign-up (spec 0012 M1, AC1): the same check-email result for new and existing addresses. */
export default function Signup() {
  const router = useRouter();
  const docs = useQuery({
    queryKey: ["public", "consent-documents"],
    queryFn: consentDocuments,
    retry: 1,
  });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [local, setLocal] = useState<Errors>({});
  const action = useAction(signup, "signup");

  const list = docs.data ?? [];
  const unavailable = docs.isError || (docs.isSuccess && list.length === 0);
  const err = (k: keyof Errors) =>
    local[k] ?? action.fields[k] ?? action.fields[`accepted_consent_document_ids`];

  const submit = async () => {
    const e: Errors = {};
    if (!fullName.trim()) e.full_name = "Enter your full name.";
    if (!isEmail(email.trim())) e.email = "Enter a valid email address, like name@company.ng.";
    const check = checkPassword(password, email);
    if (!check.longEnough) e.password = "Use at least 12 characters.";
    else if (check.tooLong) e.password = "Use 128 characters or fewer.";
    else if (check.sameAsEmail) e.password = "Don't use your email address as your password.";
    if (!accepted) e.terms = "Accept the Terms of Service and Privacy Policy to continue.";
    setLocal(e);
    if (Object.keys(e).length > 0) return;
    const sent = password;
    const res = await action.run({
      full_name: fullName.trim(),
      email: email.trim(),
      password: sent,
      phone: phone.trim() ? normalizePhone(phone) : undefined,
      accepted_consent_document_ids: list.map((d) => d.id),
    });
    setPassword("");
    if (res) router.replace("/check-email");
  };

  const docLink = (kind: string, path: string) => (
    <Text
      variant="body"
      tone="accent"
      bold
      accessibilityRole="link"
      accessibilityHint={strings.consent.opensBrowser}
      onPress={() => openLegal(path)}
    >
      {strings.consent.kinds[kind] ?? kind}
    </Text>
  );
  const terms = list.find((d) => d.kind === "terms");
  const privacy = list.find((d) => d.kind === "privacy");

  return (
    <Screen>
      <View style={{ gap: space[2] }}>
        <Text variant="title1" bold accessibilityRole="header">
          {strings.signup.title}
        </Text>
        <Text tone="text2">{strings.signup.intro}</Text>
      </View>
      {unavailable ? (
        <Notice tone="warning" title={strings.signup.docsUnavailableTitle}>
          {strings.signup.docsUnavailableBody}
        </Notice>
      ) : null}
      {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
      <TextField
        label={strings.signup.fullName}
        value={fullName}
        onChangeText={setFullName}
        error={err("full_name")}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
      />
      <TextField
        label={strings.auth.email}
        value={email}
        onChangeText={setEmail}
        error={err("email")}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={strings.signup.phone}
        hint={strings.signup.phoneHint}
        value={phone}
        onChangeText={setPhone}
        error={err("phone")}
        autoComplete="tel"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
      />
      <TextField
        label={strings.auth.password}
        hint={strings.signup.passwordHint}
        value={password}
        onChangeText={setPassword}
        error={err("password")}
        password
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <View style={{ gap: space[1] }}>
        <Checkbox
          checked={accepted}
          onChange={setAccepted}
          label={`${strings.signup.terms} ${strings.signup.termsLink} ${strings.signup.and} ${strings.signup.privacyLink}`}
        >
          <Text>
            {strings.signup.terms} {terms ? docLink("terms", terms.url) : strings.signup.termsLink}{" "}
            {strings.signup.and}{" "}
            {privacy ? docLink("privacy", privacy.url) : strings.signup.privacyLink}
          </Text>
        </Checkbox>
        {err("terms") ? (
          <Text variant="footnote" tone="dangerFg" accessibilityLiveRegion="polite">
            {err("terms")}
          </Text>
        ) : null}
      </View>
      <Button
        label={strings.signup.submit}
        busy={action.pending}
        disabled={docs.isLoading || unavailable}
        onPress={() => void submit()}
      />
      <Button
        label={strings.auth.haveAccountLink}
        variant="link"
        onPress={() => router.replace("/login")}
      />
    </Screen>
  );
}
