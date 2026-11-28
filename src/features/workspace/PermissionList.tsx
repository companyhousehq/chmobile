import { StyleSheet, Switch, View } from "react-native";
import type { PickerGroup } from "@/lib/workspace";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";
import { Badge } from "@/ui/Badge";
import { Text } from "@/ui/Text";

/** Grouped permissions. With `onToggle` it is the picker; without, a read-only list. */
export function PermissionList({
  groups,
  onToggle,
}: {
  groups: PickerGroup[];
  onToggle?: (key: string) => void;
}) {
  const { c } = useTheme();
  return (
    <>
      {groups.map((g) => (
        <View key={g.category} style={styles.group}>
          <Text variant="footnote" tone="textMuted" bold accessibilityRole="header">
            {g.category}
          </Text>
          {g.items.map((p) => (
            <View key={p.key} style={styles.item}>
              <View style={styles.text}>
                <Text bold>{p.label}</Text>
                <Text variant="footnote" tone="text2">
                  {p.description}
                </Text>
                {p.owner_only ? <Badge label={strings.ws.roles.ownerOnly} tone="warning" /> : null}
                {p.locked ? <Badge label={strings.ws.roles.alwaysOn} tone="neutral" /> : null}
                {onToggle && p.reason && !p.locked && !p.owner_only ? (
                  <Text variant="footnote" tone="textMuted">
                    {p.reason}
                  </Text>
                ) : null}
              </View>
              {onToggle ? (
                <Switch
                  accessibilityLabel={p.label}
                  value={p.selected}
                  disabled={p.disabled}
                  onValueChange={() => onToggle(p.key)}
                  trackColor={{ true: c.accent, false: c.borderStrong }}
                />
              ) : p.selected ? (
                <Badge label="Included" tone="success" />
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[3] },
  item: { flexDirection: "row", alignItems: "center", gap: space[3] },
  text: { flex: 1, gap: space[1] },
});
