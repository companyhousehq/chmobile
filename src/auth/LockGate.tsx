import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { isLockEnabled } from "@/lib/lockSettings";
import { recordUnlockFailure, shouldLockOnLaunch, shouldLockOnResume } from "@/lib/lock";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { useSession } from "./SessionProvider";

/**
 * Device lock (spec 0011 R12, design 4.6): a UI gate over a signed-in session.
 * Locks on cold start and after five minutes in the background; unlocks with
 * biometrics or the device passcode. Five failures sign out with the full
 * wipe. It never stands in for the server session or MFA, and the token is
 * not behind a biometric flag, so enrolling a new fingerprint cannot strand it.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { status, wipe } = useSession();
  const [locked, setLocked] = useState(() => shouldLockOnLaunch(isLockEnabled()));
  const [failed, setFailed] = useState(false);
  const failures = useRef(0);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backgroundedAt.current = Date.now();
      } else if (next === "active") {
        if (
          shouldLockOnResume({
            enabled: isLockEnabled(),
            backgroundedAt: backgroundedAt.current,
            now: Date.now(),
          })
        ) {
          setLocked(true);
        }
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: strings.lock.reason,
    });
    if (result.success) {
      failures.current = 0;
      setFailed(false);
      setLocked(false);
      return;
    }
    if (result.error === "user_cancel" || result.error === "system_cancel") return;
    const next = recordUnlockFailure(failures.current);
    failures.current = next.failures;
    setFailed(true);
    if (next.signOut) {
      failures.current = 0;
      setLocked(false);
      await wipe();
    }
  }, [wipe]);

  if (status !== "signedIn" || !locked) return <>{children}</>;
  return <LockScreen failed={failed} onUnlock={unlock} />;
}

function LockScreen({ failed, onUnlock }: { failed: boolean; onUnlock: () => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: c.forestDeep }]}>
      <Text variant="title2" bold accessibilityRole="header" style={{ color: c.forestText }}>
        {strings.lock.title}
      </Text>
      <Text style={{ color: c.forestMuted }}>{strings.lock.body}</Text>
      {failed ? <Text style={{ color: c.forestAccent }}>{strings.lock.failed}</Text> : null}
      <Button label={strings.lock.unlock} onPress={onUnlock} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, padding: space[6], justifyContent: "center", gap: space[4] },
});
