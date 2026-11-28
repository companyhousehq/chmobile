import { Stack } from "expo-router";
import { useState } from "react";
import { changePassword } from "@/lib/api/auth";
import { useMe } from "@/lib/api/queries";
import { useAction } from "@/lib/useAction";
import { checkPassword } from "@/lib/validation";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

/** Change password (M4, AC5): the current password is required; other sessions end, this one stays. */
export default function PasswordScreen() {
  const me = useMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [local, setLocal] = useState<{ current?: string; next?: string }>({});
  const [done, setDone] = useState(false);
  const action = useAction(changePassword, "password-change");

  const submit = async () => {
    setDone(false);
    const e: { current?: string; next?: string } = {};
    if (!current) e.current = "Enter your current password.";
    const chk = checkPassword(next, me.data?.email);
    if (!chk.longEnough) e.next = "Use at least 12 characters.";
    else if (chk.tooLong) e.next = "Use 128 characters or fewer.";
    else if (chk.sameAsEmail) e.next = "Don't use your email address as your password.";
    setLocal(e);
    if (e.current || e.next) return;
    const [c, n] = [current, next];
    const res = await action.exec(c, n);
    if (res.ok) {
      setCurrent("");
      setNext("");
      setDone(true);
    }
  };

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: strings.password.title }} />
      <Text tone="text2">{strings.password.intro}</Text>
      {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
      {done ? <Notice tone="success">{strings.password.done}</Notice> : null}
      <TextField
        label={strings.password.current}
        value={current}
        onChangeText={setCurrent}
        error={local.current ?? action.fields.current_password}
        password
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
      />
      <TextField
        label={strings.password.next}
        hint={strings.signup.passwordHint}
        value={next}
        onChangeText={setNext}
        error={local.next ?? action.fields.new_password}
        password
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Button label={strings.password.submit} busy={action.pending} onPress={() => void submit()} />
    </Screen>
  );
}
