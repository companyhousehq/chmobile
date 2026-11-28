import { useSession } from "@/auth/SessionProvider";
import { problemSlug } from "@/lib/problems";
import { strings } from "@/strings";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/**
 * Blocks every other route when the API reports the app is below the minimum
 * version (426 app-update-required) or cannot identify it
 * (400 client-identification-required). Does not sign the user out (AC12).
 */
export default function UpdateRequired() {
  const { updateRequired } = useSession();
  const unidentified =
    !!updateRequired && problemSlug(updateRequired.type) === "client-identification-required";
  return (
    <Screen>
      <Text variant="title2" bold accessibilityRole="header">
        {strings.update.title}
      </Text>
      <Text tone="text2">{unidentified ? strings.update.unidentified : strings.update.body}</Text>
    </Screen>
  );
}
