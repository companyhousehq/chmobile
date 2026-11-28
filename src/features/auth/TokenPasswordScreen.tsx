import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSession } from "@/auth/SessionProvider";
import { dropLinkToken, peekLinkToken } from "@/lib/auth/tokenStore";
import type { ProblemContext } from "@/lib/problems";
import { useAction } from "@/lib/useAction";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

interface Props {
  route: "verify-email" | "reset-password" | "confirm-email-change";
  context: ProblemContext;
  title: string;
  intro: string;
  noToken: string;
  doneTitle: string;
  doneBody: string;
  passwordLabel: string;
  submitLabel: string;
  /** Sends the parked token and the typed password; the password is not kept. */
  submit: (token: string, password: string) => Promise<unknown>;
  /** reset-password only: shows the new-password policy hint. */
  newPassword?: boolean;
}

/**
 * Email links (spec 0012 M2): the token is read once from the secure store into
 * memory, and removed on success or when the API says the link is dead. A wrong
 * password answers like an invalid link and counts toward the throttle (API).
 * Device biometrics never stand in for the password.
 */
export function TokenPasswordScreen(p: Props) {
  const router = useRouter();
  const { status } = useSession();
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(() => peekLinkToken("email", p.route));
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [local, setLocal] = useState<string>();
  const action = useAction(p.submit, p.context);

  const finish = async () => {
    await dropLinkToken("email");
    setToken(null);
  };

  const submit = async () => {
    if (!token) return;
    if (!password) {
      setLocal(p.newPassword ? "Enter a password." : "Enter your password.");
      return;
    }
    setLocal(undefined);
    const sent = password;
    setPassword("");
    const res = await action.exec(token, sent);
    if (res.ok) {
      setDone(true);
      await finish();
      if (status === "signedIn") void qc.invalidateQueries({ queryKey: ["me"] });
    }
  };

  // A dead link stays dead: drop the parked token so it can't be retried.
  if (action.slug === "token-invalid" && token) void finish();

  const leave = () => router.replace(status === "signedIn" ? "/" : "/login");

  if (done) {
    return (
      <Screen>
        <Text variant="title1" bold accessibilityRole="header">
          {p.doneTitle}
        </Text>
        <Notice tone="success">{p.doneBody}</Notice>
        <Button
          label={status === "signedIn" ? strings.verify.toApp : strings.verify.toSignIn}
          onPress={leave}
        />
      </Screen>
    );
  }

  if (!token) {
    return (
      <Screen>
        <Text variant="title1" bold accessibilityRole="header">
          {p.title}
        </Text>
        <Notice tone={action.slug === "token-invalid" ? "danger" : "warning"}>
          {action.error ?? p.noToken}
        </Notice>
        <Button
          label={p.route === "reset-password" ? strings.reset.askAgain : strings.verify.toSignIn}
          onPress={() =>
            router.replace(p.route === "reset-password" ? "/forgot-password" : leave2(status))
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title1" bold accessibilityRole="header">
        {p.title}
      </Text>
      <Text tone="text2">{p.intro}</Text>
      {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
      <TextField
        label={p.passwordLabel}
        value={password}
        onChangeText={setPassword}
        error={local ?? action.fields.password ?? action.fields.new_password}
        hint={p.newPassword ? strings.signup.passwordHint : undefined}
        password
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={p.newPassword ? "new-password" : "current-password"}
        textContentType={p.newPassword ? "newPassword" : "password"}
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <Button label={p.submitLabel} busy={action.pending} onPress={() => void submit()} />
    </Screen>
  );
}

function leave2(status: string): "/" | "/login" {
  return status === "signedIn" ? "/" : "/login";
}
