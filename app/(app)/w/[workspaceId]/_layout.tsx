import { Stack, useLocalSearchParams } from "expo-router";
import { useWorkspaceGuard } from "@/features/workspace/useWorkspaceGuard";
import { WorkspaceIdContext } from "@/features/workspace/useWorkspaceId";
import { useTheme } from "@/theme/ThemeProvider";

/** Tabs plus the screens pushed over them (invite, roles, profile). */
export default function WorkspaceLayout() {
  const { c } = useTheme();
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  useWorkspaceGuard(workspaceId ?? "");
  return (
    <WorkspaceIdContext.Provider value={workspaceId ?? ""}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </WorkspaceIdContext.Provider>
  );
}
