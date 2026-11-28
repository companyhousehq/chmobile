import * as LocalAuthentication from "expo-local-authentication";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Switch, View } from "react-native";
import { useMe, useMfaStatus } from "@/lib/api/queries";
import { isLockEnabled, setLockEnabled } from "@/lib/lockSettings";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** Security (spec 0012 M4, M5, M12-M14): MFA status and actions, sessions, device lock. */
export default function Security() {
  const router = useRouter();
  const { c } = useTheme();
  const me = useMe();
  const mfa = useMfaStatus(me.data?.id);
  const [lock, setLock] = useState(isLockEnabled);
  const [lockError, setLockError] = useState<string | null>(null);

  const toggleLock = async (next: boolean) => {
    setLockError(null);
    if (next) {
      const ready =
        (await LocalAuthentication.hasHardwareAsync()) &&
        (await LocalAuthentication.isEnrolledAsync());
      if (!ready) {
        setLockError("Set up a fingerprint, face or passcode in your phone's settings first.");
        return;
      }
    }
    setLockEnabled(next);
    setLock(next);
  };

  const m = mfa.data;
  const factor = m?.factors[0];

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: strings.security.title }} />
      <Text variant="title3" bold accessibilityRole="header">
        {strings.security.mfaHeading}
      </Text>
      <Text tone="text2">{strings.security.mfaBody}</Text>
      {mfa.isError ? <Notice tone="danger">{strings.common.offline}</Notice> : null}
      {m ? (
        <>
          <Row
            title={m.enabled ? strings.security.mfaOn : strings.security.mfaOff}
            hint={m.enabled ? strings.security.codesLeft(m.recovery_codes_remaining) : undefined}
          />
          {m.enabled && factor ? (
            <>
              <Button
                label={strings.security.newCodes}
                variant="secondary"
                onPress={() => router.push("/security/recovery-codes")}
              />
              {m.required ? (
                <Notice>{strings.security.required}</Notice>
              ) : (
                <Button
                  label={strings.security.turnOff}
                  variant="secondary"
                  destructive
                  onPress={() =>
                    router.push({ pathname: "/security/mfa-off", params: { factorId: factor.id } })
                  }
                />
              )}
            </>
          ) : (
            <Button
              label={strings.security.turnOn}
              onPress={() => router.push("/security/enrol")}
            />
          )}
        </>
      ) : null}

      <Text variant="title3" bold accessibilityRole="header">
        {strings.sessions.title}
      </Text>
      <Row
        title={strings.security.sessions}
        hint={strings.security.sessionsHint}
        onPress={() => router.push("/security/sessions")}
      />

      <Text variant="title3" bold accessibilityRole="header">
        {strings.security.lockHeading}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <Text bold>{strings.security.lockToggle}</Text>
          <Text variant="footnote" tone="textMuted">
            {strings.security.lockBody} {strings.security.lockNote}
          </Text>
        </View>
        <Switch
          accessibilityLabel={strings.security.lockToggle}
          value={lock}
          onValueChange={(v) => void toggleLock(v)}
          trackColor={{ true: c.accent }}
        />
      </View>
      {lockError ? <Notice tone="warning">{lockError}</Notice> : null}
    </Screen>
  );
}
