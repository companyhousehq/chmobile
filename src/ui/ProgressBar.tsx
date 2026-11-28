import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";

/** Progress as a bar; `label` is what a screen reader hears ("Step 2 of 5"). */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[styles.track, { backgroundColor: c.accentSoft }]}
    >
      <View style={[styles.fill, { backgroundColor: c.accent, width: `${pct * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.sm, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.sm },
});
