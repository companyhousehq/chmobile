import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LockGate } from "@/auth/LockGate";
import { SessionProvider, useSession } from "@/auth/SessionProvider";
import { createQueryClient, wireOnlineManager } from "@/lib/queryClient";
import { initSentry } from "@/lib/sentry";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

initSentry();
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  useEffect(() => wireOnlineManager(), []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <LockGate>
              <Routes />
            </LockGate>
          </SessionProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Session gate: the router picks the group from the session, so a 401 wipe lands on sign-in. */
function Routes() {
  const { status, updateRequired, gate } = useSession();
  const { scheme } = useTheme();

  useEffect(() => {
    if (status !== "loading") void SplashScreen.hideAsync();
  }, [status]);

  if (status === "loading") return null;
  const open = !updateRequired;
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!updateRequired}>
          <Stack.Screen name="update-required" />
        </Stack.Protected>
        <Stack.Protected guard={open && status === "signedOut"}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={open && status === "signedIn" && !gate}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={open && status === "signedIn" && !!gate}>
          <Stack.Screen name="(gate)" />
        </Stack.Protected>
        {/* Email links work signed in or out, but not while an update is required (AC12). */}
        <Stack.Protected guard={open}>
          <Stack.Screen name="verify-email" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="confirm-email-change" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
