import { useRouter, type Href } from "expo-router";
import { Pressable, View } from "react-native";
import { useContextLists, useMe } from "@/lib/api/queries";
import {
  buildSwitcher,
  contextHref,
  type ActingContext,
  type SwitcherEntry,
} from "@/lib/context/startingContext";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { control, space } from "@/theme/tokens";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** Context switcher (spec 0011 R5): companies first, then "Your agent workspaces". */
export default function Switch() {
  const router = useRouter();
  const { c } = useTheme();
  const me = useMe();
  const lists = useContextLists(me.data?.id);
  const model = buildSwitcher(lists.data ?? { companies: [], workspaces: [] }, null);

  const go = (ctx: ActingContext) => router.replace(contextHref(ctx) as Href);
  const section = (title: string, entries: SwitcherEntry[]) =>
    entries.length === 0 ? null : (
      <View style={{ gap: space[2] }}>
        <Text variant="footnote" tone="textMuted" bold accessibilityRole="header">
          {title}
        </Text>
        {entries.map((e) => (
          <Pressable
            key={`${e.context.kind}:${e.context.id}`}
            accessibilityRole="button"
            onPress={() => go(e.context)}
            style={{
              minHeight: control.minTarget,
              justifyContent: "center",
              padding: space[3],
              backgroundColor: c.surface,
              borderColor: c.border,
              borderWidth: 1,
              borderRadius: 8,
            }}
          >
            <Text bold>{e.label}</Text>
          </Pressable>
        ))}
      </View>
    );

  return (
    <Screen edges={["bottom"]}>
      {section(strings.switcher.companies, model.companies)}
      {section(strings.switcher.workspaces, model.workspaces)}
      <Row
        title={strings.co.mine.title}
        hint={strings.tabsYou.companiesHint}
        onPress={() => router.replace("/companies")}
      />
      <Row
        title={strings.ws.mine.title}
        hint={strings.tabsYou.workspacesHint}
        onPress={() => router.replace("/workspaces")}
      />
    </Screen>
  );
}
