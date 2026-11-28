import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { Text } from "./Text";

type Tone = "info" | "success" | "warning" | "danger";

/** Inline message. Errors and results are announced to screen readers. */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children?: string;
}) {
  const { c } = useTheme();
  const bg = { info: c.infoBg, success: c.successBg, warning: c.warningBg, danger: c.dangerBg }[
    tone
  ];
  const fg = { info: c.infoFg, success: c.successFg, warning: c.warningFg, danger: c.dangerFg }[
    tone
  ];
  const line = {
    info: c.infoLine,
    success: c.successLine,
    warning: c.warningLine,
    danger: c.dangerLine,
  }[tone];
  return (
    <View
      accessibilityRole={tone === "danger" ? "alert" : "text"}
      accessibilityLiveRegion={tone === "danger" || tone === "success" ? "polite" : "none"}
      style={[styles.box, { backgroundColor: bg, borderColor: line }]}
    >
      {title ? (
        <Text variant="footnote" bold style={{ color: fg }}>
          {title}
        </Text>
      ) : null}
      {children ? (
        <Text variant="footnote" style={{ color: fg }}>
          {children}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: space[3], gap: space[1] },
});
