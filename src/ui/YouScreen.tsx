import { useRouter } from "expo-router";
import { useSession } from "@/auth/SessionProvider";
import { useMe } from "@/lib/api/queries";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/**
 * "You" tab (both contexts, spec 0012 Navigation). Account and security are
 * companies, claims, workspaces and invitations are all reachable from here.
 */
export function YouScreen() {
  const { signOut } = useSession();
  const router = useRouter();
  const me = useMe();
  return (
    <Screen edges={["bottom"]}>
      <Text variant="title2" bold accessibilityRole="header">
        {strings.tabs.you}
      </Text>
      {me.data ? (
        <Text tone="text2">
          {me.data.full_name} · {me.data.email}
        </Text>
      ) : null}
      {me.data && !me.data.email_verified ? (
        <Notice tone="warning">{strings.tabsYou.emailUnverified}</Notice>
      ) : null}
      <Row
        title={strings.tabsYou.account}
        hint={strings.tabsYou.accountHint}
        onPress={() => router.push("/account")}
      />
      <Row
        title={strings.tabsYou.security}
        hint={strings.tabsYou.securityHint}
        onPress={() => router.push("/security")}
      />
      <Row
        title={strings.tabsYou.companies}
        hint={strings.tabsYou.companiesHint}
        onPress={() => router.push("/companies")}
      />
      <Row
        title={strings.tabsYou.workspaces}
        hint={strings.tabsYou.workspacesHint}
        onPress={() => router.push("/workspaces")}
      />
      <Button label={strings.common.signOut} variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
