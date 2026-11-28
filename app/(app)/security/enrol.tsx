import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { EnrolFlow } from "@/features/mfa/EnrolFlow";
import { strings } from "@/strings";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";

/** Turn on two-factor sign-in (M12). The API ends other sessions when it succeeds (AC15). */
export default function Enrol() {
  const router = useRouter();
  const qc = useQueryClient();
  const [finished, setFinished] = useState(false);
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: strings.enrol.title }} />
      {finished ? (
        <Notice tone="success">{strings.enrol.finished}</Notice>
      ) : (
        <EnrolFlow
          onFinished={() => {
            setFinished(true);
            void qc.invalidateQueries({ queryKey: ["u"] });
            router.back();
          }}
        />
      )}
    </Screen>
  );
}
