import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { regenerateRecoveryCodes } from "@/lib/api/auth";
import { RecoveryCodes } from "@/features/mfa/RecoveryCodes";
import { useAction } from "@/lib/useAction";
import { normalizeTotp } from "@/lib/validation";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

/**
 * Regenerate recovery codes (M13, AC18): password plus an authenticator code,
 * never a recovery code. The new codes reuse the privacy-screened screen.
 */
export default function RegenerateCodes() {
  const router = useRouter();
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [local, setLocal] = useState<{ password?: string; code?: string }>({});
  const [codes, setCodes] = useState<string[] | null>(null);
  const action = useAction(regenerateRecoveryCodes, "mfa");

  const submit = async () => {
    const e: { password?: string; code?: string } = {};
    if (!password) e.password = "Enter your password.";
    if (normalizeTotp(code).length !== 6)
      e.code = "Enter the 6-digit code from your authenticator app.";
    setLocal(e);
    if (e.password || e.code) return;
    const [p, c6] = [password, normalizeTotp(code)];
    setPassword("");
    setCode("");
    const res = await action.run(p, c6);
    if (res) setCodes(res.recovery_codes);
  };

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: strings.regen.title }} />
      {codes ? (
        <RecoveryCodes
          codes={codes}
          onFinish={() => {
            setCodes(null);
            void qc.invalidateQueries({ queryKey: ["u"] });
            router.back();
          }}
        />
      ) : (
        <>
          <Text tone="text2">{strings.regen.intro}</Text>
          {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
          <TextField
            label={strings.regen.password}
            value={password}
            onChangeText={setPassword}
            error={local.password ?? action.fields.current_password}
            password
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
          />
          <TextField
            label={strings.regen.code}
            value={code}
            onChangeText={(v) => setCode(normalizeTotp(v))}
            error={local.code ?? action.fields.code}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={7}
          />
          <Button
            label={strings.regen.submit}
            busy={action.pending}
            onPress={() => void submit()}
          />
        </>
      )}
    </Screen>
  );
}
