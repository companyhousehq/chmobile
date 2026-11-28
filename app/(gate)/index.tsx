import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useSession } from "@/auth/SessionProvider";
import { ConsentGate } from "@/features/auth/ConsentGate";
import { EnrolFlow } from "@/features/mfa/EnrolFlow";
import { MfaChallenge } from "@/features/mfa/MfaChallenge";
import { mfaStatus } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { gateFromMfaStage } from "@/lib/auth/gate";
import { problemMessage } from "@/lib/problems";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";

/**
 * The only screen reachable while the API wants more from the session (M3,
 * M11): a factor challenge, a mandatory enrolment, or consent. Sign-out is
 * always offered. The server decides every step; this only shows its outcome.
 */
export default function Gate() {
  const { gate, setGate, applyRequirements, signOut } = useSession();
  const { c } = useTheme();
  const qc = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (gate !== "unknown") return;
    let live = true;
    mfaStatus()
      .then((s) => live && setGate(gateFromMfaStage(s.stage)))
      .catch((e: unknown) => {
        if (!live) return;
        setFailure(
          problemMessage(
            e instanceof ApiError ? e.problem : { type: "/problems/unavailable", status: 0 },
          ),
        );
      });
    return () => {
      live = false;
    };
  }, [gate, setGate, attempt]);

  const proceed = (requirements?: string[]) => {
    applyRequirements(requirements);
    void qc.invalidateQueries();
  };

  return (
    <Screen>
      {gate === "factor" ? <MfaChallenge onVerified={proceed} /> : null}
      {gate === "factor_setup" ? <EnrolFlow onFinished={proceed} /> : null}
      {gate === "consent" ? <ConsentGate onAccepted={() => proceed([])} /> : null}
      {gate === "unknown" ? (
        failure ? (
          <>
            <Notice tone="danger">{failure}</Notice>
            <Button
              label={strings.common.retry}
              onPress={() => {
                setFailure(null);
                setAttempt((n) => n + 1);
              }}
            />
          </>
        ) : (
          <ActivityIndicator accessibilityLabel={strings.common.loading} color={c.accent} />
        )
      ) : null}
      <Button label={strings.common.signOut} variant="link" onPress={() => void signOut()} />
    </Screen>
  );
}
