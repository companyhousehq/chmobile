import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { control, radius, space } from "@/theme/tokens";
import { Text } from "./Text";

/** A single-choice filter row. */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => onChange(o.value)}
            style={[
              styles.chip,
              {
                backgroundColor: on ? c.accent : c.surface,
                borderColor: on ? c.accent : c.borderStrong,
              },
            ]}
          >
            <Text variant="footnote" bold style={{ color: on ? c.onAccent : c.text }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  chip: {
    minHeight: control.minTarget,
    justifyContent: "center",
    paddingHorizontal: space[3],
    borderWidth: 1,
    borderRadius: radius.lg,
  },
});
