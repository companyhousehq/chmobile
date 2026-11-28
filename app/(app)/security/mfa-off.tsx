import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { disableMfaFactor } from "@/lib/api/auth";
import { useAction } from "@/lib/useAction";
import { normalizeRecoveryCode, normalizeTotp } from "@/lib/validation";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

/** Turn off MFA (M13, 0008 R13): password plus an authenticator code or a recovery code. The API decides. */
export default function MfaOff() {
  const router = useRouter();
  const qc = useQueryClient();
  const { factorId } = useLocalSearchParams<{ factorId: string }>();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [local, setLocal] = useState<{ password?: string; code?: string }>({});
  const [done, setDone] = useState(false);
  const action = useAction(disableMfaFactor, "mfa");

  const submit = async () => {
    const e: { password?: string; code?: string } = {};
    if (!password) e.password = "Enter your password.";
    if (recovery ? !normalizeRecoveryCode(code) : normalizeTotp(code).length !== 6) {
      e.code = recovery
        ? "Enter one of your recovery codes."
        : "Enter the 6-digit code from your authenticator app.";
    }
    setLocal(e);
    if (e.password || e.code || !factorId) return;
    const body = recovery
      ? { current_password: password, recovery_code: normalizeRecoveryCode(code) }
      : { current_password: password, code: normalizeTotp(code) };
    setPassword("");
    setCode("");
    const res = await action.exec(factorId, body);
    if (res.ok) {
      setDone(true);
      void qc.invalidateQueries({ queryKey: ["u"] });
    }
  };

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: strings.mfaOff.title }} />
      {done ? (
        <>
          <Notice tone="success">{strings.mfaOff.done}</Notice>
          <Button label={strings.common.done} onPress={() => router.back()} />
        </>
      ) : (
        <>
          <Text tone="text2">{strings.mfaOff.intro}</Text>
          {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
          <TextField
            label={strings.mfaOff.password}
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
            label={recovery ? strings.mfaChallenge.recoveryCode : strings.mfaOff.code}
            value={code}
            onChangeText={(v) => setCode(recovery ? v : normalizeTotp(v))}
            error={local.code ?? action.fields.code ?? action.fields.recovery_code}
            keyboardType={recovery ? "default" : "number-pad"}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={recovery ? "off" : "one-time-code"}
            textContentType={recovery ? "none" : "oneTimeCode"}
          />
          <Button
            label={recovery ? strings.mfaChallenge.useApp : strings.mfaChallenge.useRecovery}
            variant="link"
            onPress={() => {
              setRecovery((r) => !r);
              setCode("");
            }}
          />
          <Button
            label={strings.mfaOff.submit}
            destructive
            busy={action.pending}
            onPress={() => void submit()}
          />
        </>
      )}
    </Screen>
  );
}
