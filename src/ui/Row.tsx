import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { control, radius, space } from "@/theme/tokens";
import { Text } from "./Text";

/** A tappable list row (title, optional hint) with a chevron; or a static row when no onPress. */
export function Row({
  title,
  hint,
  onPress,
  disabled,
  right,
}: {
  title: string;
  hint?: string;
  onPress?: () => void;
  disabled?: boolean;
  right?: ReactNode;
}) {
  const { c } = useTheme();
  const body = (
    <>
      <View style={styles.text}>
        <Text bold>{title}</Text>
        {hint ? (
          <Text variant="footnote" tone="textMuted">
            {hint}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && !disabled ? (
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      ) : null}
    </>
  );
  const box = [styles.row, { backgroundColor: c.surface, borderColor: c.border }];
  if (!onPress) return <View style={box}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${title}. ${hint}` : title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [box, (disabled || pressed) && { opacity: disabled ? 0.55 : 0.85 }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: control.minTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    padding: space[3],
    borderWidth: 1,
    borderRadius: radius.md,
  },
  text: { flex: 1, gap: space[1] },
});
