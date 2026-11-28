import { Stack } from "expo-router";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";

export default function AppLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="switch"
        options={{ presentation: "modal", headerShown: true, title: strings.switcher.title }}
      />
      <Stack.Screen
        name="invitation"
        options={{
          headerShown: true,
          title: strings.ws.link.title,
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerBackVisible: false,
        }}
      />
    </Stack>
  );
}
