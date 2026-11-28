import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { requestEmailChange } from "@/lib/api/auth";
import { keys } from "@/lib/api/queries";
import { useAction } from "@/lib/useAction";
import { isEmail } from "@/lib/validation";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

/** Change email (M4): password first; the old email keeps working until the link is confirmed. */
export default function EmailScreen() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [local, setLocal] = useState<{ email?: string; password?: string }>({});
  const [done, setDone] = useState(false);
  const action = useAction(requestEmailChange, "password-change");

  const submit = async () => {
    const e: { email?: string; password?: string } = {};
    if (!isEmail(email.trim())) e.email = "Enter a valid email address, like name@company.ng.";
    if (!password) e.password = "Enter your password.";
    setLocal(e);
    if (e.email || e.password) return;
    const pw = password;
    setPassword("");
    const res = await action.exec(email.trim(), pw);
    if (res.ok) {
      setDone(true);
      void qc.invalidateQueries({ queryKey: keys.me });
    }
  };

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: strings.emailChange.title }} />
      <Text tone="text2">{strings.emailChange.intro}</Text>
      {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
      {done ? <Notice tone="success">{strings.emailChange.done}</Notice> : null}
      <TextField
        label={strings.emailChange.newEmail}
        value={email}
        onChangeText={setEmail}
        error={local.email ?? action.fields.new_email}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={strings.emailChange.password}
        value={password}
        onChangeText={setPassword}
        error={local.password ?? action.fields.current_password}
        password
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
      />
      <Button
        label={strings.emailChange.submit}
        busy={action.pending}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
