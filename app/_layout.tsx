import { BagelFatOne_400Regular } from "@expo-google-fonts/bagel-fat-one";
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ConfettiLayer, HeartBurstLayer, ThemeProvider, ToastProvider, useTheme } from "@/design";
import { Grain } from "@/design/layout/Grain";
import { SplashOverlay } from "@/design/layout/SplashOverlay";
import { useSyncLifecycle, useRealtimeEffects } from "@/features/widgetSync/useSyncLifecycle";
import { useWidgetSync } from "@/features/widgetSync/useWidgetSync";
import { useSettings } from "@/state/settingsStore";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { colors, dark } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useSettings((s) => s.hydrated);
  const onboardingDone = useSettings((s) => s.onboardingDone);
  useWidgetSync();
  useSyncLifecycle();
  useRealtimeEffects();

  // Primo avvio: onboarding. Dopo, mai più (finché non lo si rivede da "Noi").
  useEffect(() => {
    if (!hydrated) return;
    const inOnboarding = segments[0] === "onboarding";
    if (!onboardingDone && !inOnboarding) router.replace("/onboarding");
    if (onboardingDone && inOnboarding) router.replace("/");
  }, [hydrated, onboardingDone, segments, router]);

  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        <Stack.Screen name="design-lab" options={{ presentation: "card" }} />
      </Stack>
      <Grain />
      <HeartBurstLayer />
      <ConfettiLayer />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BagelFatOne_400Regular,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  const hydrated = useSettings((s) => s.hydrated);
  const ready = fontsLoaded && hydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Render bloccato finché font e preferenze non sono pronti: nessun flash di font di sistema.
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider>
            <ToastProvider>
              <Shell />
              <SplashOverlay ready />
            </ToastProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
