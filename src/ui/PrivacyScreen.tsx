import { usePreventScreenCapture } from "expo-screen-capture";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";
import { Text } from "./Text";

/**
 * Hides sensitive content (recovery codes, MFA setup) from captures and the
 * app-switcher (spec 0011 R18, design 9.4). Android: capture is blocked
 * (FLAG_SECURE also blanks the snapshot). iOS: a full-screen cover replaces
 * the content whenever the app is not active.
 */
export function PrivacyScreen({ children }: { children: ReactNode }) {
  usePreventScreenCapture("sensitive");
  const { c } = useTheme();
  const [state, setState] = useState(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", setState);
    return () => sub.remove();
  }, []);
  const cover = Platform.OS === "ios" && state !== "active";
  return (
    <View style={styles.fill}>
      {cover ? (
        <View style={[styles.cover, { backgroundColor: c.forestDeep }]} accessible={false}>
          <Text bold style={{ color: c.forestText }}>
            {strings.appName}
          </Text>
          <Text variant="footnote" style={{ color: c.forestMuted }}>
            {strings.recovery.hidden}
          </Text>
        </View>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { flex: 1, alignItems: "center", justifyContent: "center", gap: space[2] },
});
