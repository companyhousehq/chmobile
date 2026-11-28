import { useRouter } from "expo-router";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** Same screen for a new and an already-registered email (0001 R2, AC1). */
export default function CheckEmail() {
  const router = useRouter();
  return (
    <Screen>
      <Text variant="title1" bold accessibilityRole="header">
        {strings.signup.checkEmailTitle}
      </Text>
      <Text tone="text2">{strings.signup.checkEmailBody}</Text>
      <Notice>{strings.signup.checkEmailNote}</Notice>
      <Button label={strings.signup.toSignIn} onPress={() => router.replace("/login")} />
    </Screen>
  );
}
