import { useRouter } from "expo-router";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/api/auth";
import { useAction } from "@/lib/useAction";
import { isEmail } from "@/lib/validation";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

/** Uniform response whether or not the address is registered (0001 R7). */
export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [local, setLocal] = useState<string>();
  const [sent, setSent] = useState(false);
  const action = useAction(requestPasswordReset, "reset");

  const submit = async () => {
    if (!isEmail(email.trim())) {
      setLocal("Enter a valid email address, like name@company.ng.");
      return;
    }
    setLocal(undefined);
    if (await action.run(email.trim())) setSent(true);
  };

  if (sent) {
    return (
      <Screen>
        <Text variant="title1" bold accessibilityRole="header">
          {strings.forgot.sentTitle}
        </Text>
        <Text tone="text2">{strings.forgot.sentBody}</Text>
        <Button label={strings.forgot.back} onPress={() => router.replace("/login")} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Text variant="title1" bold accessibilityRole="header">
        {strings.forgot.title}
      </Text>
      <Text tone="text2">{strings.forgot.intro}</Text>
      {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
      <TextField
        label={strings.auth.email}
        value={email}
        onChangeText={setEmail}
        error={local ?? action.fields.email}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
      />
      <Button label={strings.forgot.submit} busy={action.pending} onPress={() => void submit()} />
      <Button label={strings.forgot.back} variant="link" onPress={() => router.back()} />
    </Screen>
  );
}
