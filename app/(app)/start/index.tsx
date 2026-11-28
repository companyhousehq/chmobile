import { useRouter } from "expo-router";
import { useSession } from "@/auth/SessionProvider";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { IndependenceNotice } from "@/ui/IndependenceNotice";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/**
 * Business-owner start for a user with no company or workspace (0011 R4, AC4).
 * The user can find and claim a company, open their companies and claims,
 * the agency start, their account and sign-out, so nothing is a dead end.
 */
export default function Start() {
  const router = useRouter();
  const { signOut } = useSession();
  return (
    <Screen>
      <Text variant="title1" bold accessibilityRole="header">
        {strings.start.title}
      </Text>
      <Text tone="text2">{strings.start.body}</Text>
      <Notice>{strings.start.findNote}</Notice>
      <IndependenceNotice />
      <Button label={strings.start.findCompany} onPress={() => router.push("/companies/find")} />
      <Button
        label={strings.co.mine.title}
        variant="secondary"
        onPress={() => router.push("/companies")}
      />
      <Button
        label={strings.start.agencyLink}
        variant="link"
        onPress={() => router.push("/start/agency")}
      />
      <Button
        label={strings.start.account}
        variant="secondary"
        onPress={() => router.push("/account")}
      />
      <Button label={strings.common.signOut} variant="link" onPress={() => void signOut()} />
    </Screen>
  );
}
