import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { control, radius, space } from "@/theme/tokens";
import { Text } from "./Text";

interface Props {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "link";
  disabled?: boolean;
  /** Shows progress and blocks repeat taps while a request is running. */
  busy?: boolean;
  destructive?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  busy,
  destructive,
}: Props) {
  const { c } = useTheme();
  const primary = variant === "primary";
  const off = !!disabled || !!busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "link" && styles.link,
        primary && { backgroundColor: destructive ? c.dangerSolid : c.accent },
        variant === "secondary" && {
          backgroundColor: c.surface,
          borderColor: c.borderStrong,
          borderWidth: 1,
        },
        (off || pressed) && { opacity: off ? 0.5 : 0.85 },
      ]}
    >
      <Text
        variant="callout"
        bold
        style={{
          color: primary
            ? destructive
              ? c.onDanger
              : c.onAccent
            : variant === "link"
              ? destructive
                ? c.dangerFg
                : c.accent
              : destructive
                ? c.dangerFg
                : c.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: control.buttonHeight,
    minWidth: control.minTarget,
    borderRadius: radius.md,
    paddingHorizontal: space[5],
    alignItems: "center",
    justifyContent: "center",
  },
  link: { backgroundColor: "transparent" },
});
