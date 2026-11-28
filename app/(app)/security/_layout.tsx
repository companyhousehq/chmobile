import { Stack } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";

export default function Layout() {
  const { c } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
      }}
    />
  );
}
