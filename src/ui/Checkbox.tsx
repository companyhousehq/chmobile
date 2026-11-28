import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { control, radius, space } from "@/theme/tokens";

export function Checkbox({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Spoken label; the visible text is `children`. */
  label: string;
  children: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          { borderColor: c.borderStrong, backgroundColor: checked ? c.accent : c.surface },
        ]}
      >
        {checked ? <Ionicons name="checkmark" size={18} color={c.onAccent} /> : null}
      </View>
      <View style={styles.label}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space[3],
    alignItems: "flex-start",
    minHeight: control.minTarget,
  },
  box: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  label: { flex: 1 },
});
