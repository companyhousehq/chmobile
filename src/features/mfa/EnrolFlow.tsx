import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { confirmTotpSetup, startTotpSetup } from "@/lib/api/auth";
import { useAction } from "@/lib/useAction";
import { normalizeTotp } from "@/lib/validation";
import type { TotpSetup } from "@/lib/types";
import { strings } from "@/strings";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { PrivacyScreen } from "@/ui/PrivacyScreen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";
import { QrCode } from "./QrCode";
import { RecoveryCodes } from "./RecoveryCodes";

type Step = "password" | "setup" | "confirm" | "codes";

const STEP_NO: Record<Step, number> = { password: 1, setup: 2, confirm: 3, codes: 4 };
const CLIPBOARD_CLEAR_MS = 60_000;

/**
 * MFA enrolment (spec 0012 M12, AC15): password, setup, confirm, recovery
 * codes. The secret and URI exist only in this component's state and are
 * dropped when it finishes or unmounts; nothing is logged or persisted, and
 * the QR is drawn on the device. The same flow serves Security and the
 * mandatory staff path.
 */
export function EnrolFlow({
  onFinished,
}: {
  onFinished: (requirements: string[] | undefined) => void;
}) {
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<string[] | undefined>();
  const [local, setLocal] = useState<string>();
  const [notice, setNotice] = useState<string | null>(null);
  const clipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useAction(startTotpSetup, "mfa");
  const confirm = useAction(confirmTotpSetup, "mfa");

  useEffect(
    () => () => {
      if (clipTimer.current) {
        clearTimeout(clipTimer.current);
        void Clipboard.setStringAsync("").catch(() => {});
      }
    },
    [],
  );

  const doStart = async () => {
    if (!password) {
      setLocal("Enter your password.");
      return;
    }
    setLocal(undefined);
    const sent = password;
    setPassword("");
    const res = await start.run(sent, Platform.OS === "ios" ? "iPhone" : "Android phone");
    if (res) {
      setSetup(res);
      setStep("setup");
    }
  };

  const openAuthenticator = async () => {
    if (!setup) return;
    setNotice(null);
    try {
      await Linking.openURL(setup.otpauth_uri);
    } catch {
      setNotice(strings.enrol.openFailed);
    }
  };

  const copyKey = async () => {
    if (!setup) return;
    await Clipboard.setStringAsync(setup.secret);
    setNotice(strings.enrol.keyCopied);
    if (clipTimer.current) clearTimeout(clipTimer.current);
    clipTimer.current = setTimeout(() => {
      clipTimer.current = null;
      void Clipboard.setStringAsync("").catch(() => {});
    }, CLIPBOARD_CLEAR_MS);
  };

  const doConfirm = async (value: string) => {
    if (!setup) return;
    const c6 = normalizeTotp(value);
    if (c6.length !== 6) {
      setLocal("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setLocal(undefined);
    setCode("");
    const res = await confirm.run(setup.factor_id, c6);
    if (res) {
      // The secret is no longer needed: drop it before showing the codes.
      setSetup(null);
      setCodes(res.recovery_codes);
      setRequirements(res.requirements);
      setStep("codes");
    } else if (confirm.slug === "factor-not-pending") {
      setSetup(null);
    }
  };

  if (step === "codes") {
    return (
      <RecoveryCodes
        codes={codes}
        onFinish={() => {
          setCodes([]);
          onFinished(requirements);
        }}
      />
    );
  }

  const header = (title: string) => (
    <>
      <Text variant="footnote" tone="textMuted">
        {strings.enrol.stepOf(STEP_NO[step], 4)}
      </Text>
      <Text variant="title2" bold accessibilityRole="header">
        {title}
      </Text>
    </>
  );

  if (step === "password") {
    return (
      <View style={{ gap: space[4] }}>
        {header(strings.enrol.passwordTitle)}
        <Text tone="text2">{strings.enrol.passwordBody}</Text>
        {start.error ? <Notice tone="danger">{start.error}</Notice> : null}
        <TextField
          label={strings.enrol.password}
          value={password}
          onChangeText={setPassword}
          error={local ?? start.fields.current_password}
          password
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void doStart()}
        />
        <Button label={strings.enrol.start} busy={start.pending} onPress={() => void doStart()} />
      </View>
    );
  }

  if (!setup) {
    return (
      <View style={{ gap: space[4] }}>
        {header(strings.enrol.title)}
        <Notice tone="warning">{confirm.error ?? strings.mfaChallenge.expired}</Notice>
        <Button
          label={strings.enrol.startAgain}
          onPress={() => {
            confirm.reset();
            setStep("password");
          }}
        />
      </View>
    );
  }

  if (step === "setup") {
    return (
      <PrivacyScreen>
        <View style={{ gap: space[4] }}>
          {header(strings.enrol.setupTitle)}
          <Text tone="text2">{strings.enrol.setupSame}</Text>
          <Button label={strings.enrol.openApp} onPress={() => void openAuthenticator()} />
          {notice ? <Notice tone="info">{notice}</Notice> : null}
          <Text variant="footnote" tone="text2" bold>
            {strings.enrol.manual}
          </Text>
          <Text
            selectable
            bold
            accessibilityLabel={`Setup key: ${setup.secret.split("").join(" ")}`}
          >
            {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
          </Text>
          <Button
            label={strings.enrol.copyKey}
            variant="secondary"
            onPress={() => void copyKey()}
          />
          <Text variant="footnote" tone="text2" bold>
            {strings.enrol.qr}
          </Text>
          <QrCode value={setup.otpauth_uri} label={strings.enrol.qrLabel} />
          <Text variant="footnote" tone="textMuted">
            {strings.enrol.secretNote}
          </Text>
          <Button label={strings.enrol.next} onPress={() => setStep("confirm")} />
        </View>
      </PrivacyScreen>
    );
  }

  return (
    <PrivacyScreen>
      <View style={{ gap: space[4] }}>
        {header(strings.enrol.confirmTitle)}
        <Text tone="text2">{strings.enrol.confirmBody}</Text>
        {confirm.error ? <Notice tone="danger">{confirm.error}</Notice> : null}
        <TextField
          label={strings.mfaChallenge.code}
          value={code}
          onChangeText={(v) => {
            const next = normalizeTotp(v);
            setCode(next);
            if (next.length === 6) void doConfirm(next);
          }}
          error={local ?? confirm.fields.code}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={7}
          autoFocus
        />
        <Button
          label={strings.enrol.confirm}
          busy={confirm.pending}
          onPress={() => void doConfirm(code)}
        />
        <Button label={strings.common.back} variant="link" onPress={() => setStep("setup")} />
      </View>
    </PrivacyScreen>
  );
}
