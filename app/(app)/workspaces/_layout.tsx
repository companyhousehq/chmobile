import { Stack } from "expo-router";
import { strings } from "@/strings";
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
    >
      <Stack.Screen name="index" options={{ title: strings.ws.mine.title }} />
      <Stack.Screen name="new" options={{ title: strings.ws.create.title }} />
    </Stack>
  );
}
