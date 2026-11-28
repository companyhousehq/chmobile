import { useEffect, useState } from "react";
import { verifyMfa } from "@/lib/api/auth";
import { useAction } from "@/lib/useAction";
import { normalizeRecoveryCode, normalizeTotp } from "@/lib/validation";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

/**
 * Sign-in second step (spec 0012 M11, AC14): a six-digit code with one-time
 * code autofill, a switch to a recovery code, and the throttle wait shown as a
 * countdown. The server decides when a code is accepted; the wait only stops
 * pointless taps.
 */
export function MfaChallenge({ onVerified }: { onVerified: (requirements: string[]) => void }) {
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [local, setLocal] = useState<string>();
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const action = useAction(verifyMfa, "mfa");

  useEffect(() => {
    if (!waitUntil) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= waitUntil) {
        setWaitUntil(null);
        action.reset();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset is stable
  }, [waitUntil]);

  const remaining = waitUntil ? Math.max(0, Math.ceil((waitUntil - now) / 1000)) : 0;

  const submit = async (value: string) => {
    if (remaining > 0) return;
    const body = recovery
      ? { recovery_code: normalizeRecoveryCode(value) }
      : { code: normalizeTotp(value) };
    if (recovery ? !body.recovery_code : normalizeTotp(value).length !== 6) {
      setLocal(
        recovery
          ? "Enter one of your recovery codes."
          : "Enter the 6-digit code from your authenticator app.",
      );
      return;
    }
    setLocal(undefined);
    setCode("");
    const res = await action.exec(body);
    if (res.ok) onVerified(res.value.requirements ?? []);
    else if (res.slug === "too-many-attempts") {
      const t = Date.now();
      setNow(t);
      setWaitUntil(t + (res.retryAfterSeconds ?? 60) * 1000);
    }
  };

  return (
    <>
      <Text variant="title1" bold accessibilityRole="header">
        {strings.mfaChallenge.title}
      </Text>
      <Text tone="text2">
        {recovery ? strings.mfaChallenge.recoveryIntro : strings.mfaChallenge.intro}
      </Text>
      {remaining > 0 ? (
        <Notice tone="warning">{strings.mfaChallenge.wait(remaining)}</Notice>
      ) : action.error ? (
        <Notice tone="danger">{action.error}</Notice>
      ) : null}
      {recovery ? (
        <TextField
          key="recovery"
          label={strings.mfaChallenge.recoveryCode}
          value={code}
          onChangeText={setCode}
          error={local ?? action.fields.recovery_code}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => void submit(code)}
        />
      ) : (
        <TextField
          key="totp"
          label={strings.mfaChallenge.code}
          value={code}
          onChangeText={(v) => {
            const next = normalizeTotp(v);
            setCode(next);
            if (next.length === 6) void submit(next);
          }}
          error={local ?? action.fields.code}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={7}
          autoFocus
        />
      )}
      <Button
        label={strings.mfaChallenge.submit}
        busy={action.pending}
        disabled={remaining > 0}
        onPress={() => void submit(code)}
      />
      <Button
        label={recovery ? strings.mfaChallenge.useApp : strings.mfaChallenge.useRecovery}
        variant="link"
        onPress={() => {
          setRecovery((r) => !r);
          setCode("");
          setLocal(undefined);
          action.reset();
        }}
      />
    </>
  );
}
