import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { Text } from "./Text";

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "success" | "warning" | "neutral" | "danger";
}) {
  const { c } = useTheme();
  const bg = {
    success: c.successBg,
    warning: c.warningBg,
    neutral: c.neutralBg,
    danger: c.dangerBg,
  }[tone];
  const fg = {
    success: c.successFg,
    warning: c.warningFg,
    neutral: c.neutralFg,
    danger: c.dangerFg,
  }[tone];
  const line = {
    success: c.successLine,
    warning: c.warningLine,
    neutral: c.neutralLine,
    danger: c.dangerLine,
  }[tone];
  return (
    <View style={[styles.box, { backgroundColor: bg, borderColor: line }]}>
      <Text variant="caption" bold style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
});
