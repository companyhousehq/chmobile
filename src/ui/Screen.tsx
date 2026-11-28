import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";

/** Canvas-coloured, safe-area aware scrolling screen. */
export function Screen({ children, edges }: { children: ReactNode; edges?: ("top" | "bottom")[] }) {
  const { c } = useTheme();
  return (
    <SafeAreaView
      style={[styles.fill, { backgroundColor: c.canvas }]}
      edges={edges ?? ["top", "bottom"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space[5], gap: space[4], flexGrow: 1 },
});
