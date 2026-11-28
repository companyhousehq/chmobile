import { StyleSheet, View } from "react-native";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { Text } from "./Text";

/** Rule 8: shown on claim, verification and filing screens, and sign-in. */
export function IndependenceNotice() {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="text"
      style={[styles.box, { backgroundColor: c.infoBg, borderColor: c.infoLine }]}
    >
      <Text variant="footnote" style={{ color: c.infoFg }}>
        {strings.auth.independence}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: space[3] },
});
