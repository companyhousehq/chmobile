import { useRouter } from "expo-router";
import { PendingInvitations } from "@/features/workspace/PendingInvitations";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.ws.agencyStart;

/** Agent start: create a workspace or join one by invitation (spec 0001). */
export default function AgencyStart() {
  const router = useRouter();
  return (
    <Screen>
      <Text variant="title1" bold accessibilityRole="header">
        {t.title}
      </Text>
      <Text tone="text2">{t.body}</Text>
      <Button label={strings.ws.mine.create} onPress={() => router.push("/workspaces/new")} />
      <Text variant="title3" bold accessibilityRole="header">
        {t.join}
      </Text>
      <Notice>{t.joinBody}</Notice>
      <PendingInvitations />
    </Screen>
  );
}
