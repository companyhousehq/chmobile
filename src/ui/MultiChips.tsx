import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { control, radius, space } from "@/theme/tokens";
import { Text } from "./Text";

/** A multiple-choice chip group (checkbox semantics). */
export function MultiChips({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View accessibilityLabel={label} style={styles.row}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <Pressable
            key={o.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
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
