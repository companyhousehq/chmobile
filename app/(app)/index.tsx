import { Redirect, type Href } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/auth/SessionProvider";
import { useContextLists, useMe } from "@/lib/api/queries";
import {
  contextHref,
  parseContext,
  lastContextKey,
  resolveStartingContext,
} from "@/lib/context/startingContext";
import { problemMessage } from "@/lib/problems";
import { ApiError } from "@/lib/api/client";
import { peekLinkToken } from "@/lib/auth/tokenStore";
import { store } from "@/lib/storage/mmkv";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** Starting-context resolver (spec 0011 R4, design 4.5). */
export default function Resolver() {
  const { c } = useTheme();
  const { signOut } = useSession();
  const me = useMe();
  const lists = useContextLists(me.data?.id);

  const failure = me.error ?? lists.error;
  if (failure) {
    const problem =
      failure instanceof ApiError ? failure.problem : { type: "/problems/unavailable", status: 0 };
    return (
      <Screen>
        <Text accessibilityRole="alert">{problemMessage(problem)}</Text>
        <Button
          label={strings.common.retry}
          onPress={() => {
            void me.refetch();
            void lists.refetch();
          }}
        />
        <Button label={strings.common.signOut} variant="link" onPress={() => void signOut()} />
      </Screen>
    );
  }

  if (!me.data || !lists.data) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.canvas,
        }}
      >
        <ActivityIndicator accessibilityLabel={strings.common.loading} color={c.accent} />
      </View>
    );
  }

  // A parked invitation link comes first, so sign-in returns to the same invitation (AC10).
  if (peekLinkToken("invitation", "invitation")) return <Redirect href="/invitation" />;

  const lastUsed = parseContext(store("app").getString(lastContextKey(me.data.id)));
  const target = resolveStartingContext(lists.data, lastUsed);
  return <Redirect href={contextHref(target) as Href} />;
}
