import { Stack, useLocalSearchParams } from "expo-router";
import { useCompanyGuard } from "@/features/company/useCompanyGuard";
import { CompanyIdContext } from "@/features/company/useCompanyId";
import { useTheme } from "@/theme/ThemeProvider";

/** Tabs plus the screens pushed over them (invite, notices, questionnaire). */
export default function CompanyLayout() {
  const { c } = useTheme();
  const { companyId } = useLocalSearchParams<{ companyId: string }>();
  useCompanyGuard(companyId ?? "");
  return (
    <CompanyIdContext.Provider value={companyId ?? ""}>
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
    </CompanyIdContext.Provider>
  );
}
