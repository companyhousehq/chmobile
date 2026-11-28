import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { Pressable } from "react-native";
import { useContextLists, useMe } from "@/lib/api/queries";
import { buildSwitcher, type ActingContext } from "@/lib/context/startingContext";
import { useRememberContext } from "@/lib/context/useRememberContext";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { control, space } from "@/theme/tokens";

type IconName = keyof typeof Ionicons.glyphMap;

export interface TabSpec {
  name: string;
  title: string;
  icon: IconName;
  /** Not shown: the member lacks the permission for this tab. */
  hidden?: boolean;
}

/**
 * Tab bar shared by the company and agent contexts. The header shows the
 * context name and, only with more than one context, the switcher (R5).
 * Tabs show only what the user may use; the API still decides (R6).
 */
export function ContextTabs({ context, tabs }: { context: ActingContext; tabs: TabSpec[] }) {
  const { c } = useTheme();
  const router = useRouter();
  const me = useMe();
  const lists = useContextLists(me.data?.id);
  useRememberContext(context);

  const model = buildSwitcher(lists.data ?? { companies: [], workspaces: [] }, context);
  const current = [...model.companies, ...model.workspaces].find((e) => e.current);

  return (
    <Tabs
      screenOptions={{
        headerTitle: current?.label ?? strings.appName,
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerShadowVisible: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        headerRight: model.visible
          ? () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={strings.switcher.title}
                onPress={() => router.push("/switch")}
                style={{
                  minWidth: control.minTarget,
                  minHeight: control.minTarget,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: space[1],
                }}
              >
                <Ionicons name="swap-horizontal" size={22} color={c.accent} />
              </Pressable>
            )
          : undefined,
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            href: t.hidden ? null : undefined,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={t.icon} size={size} color={String(color)} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
