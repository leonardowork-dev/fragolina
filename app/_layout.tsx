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
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ConfettiLayer, HeartBurstLayer, ThemeProvider, ToastProvider, useTheme } from "@/design";
import { Grain } from "@/design/layout/Grain";
import { SplashOverlay } from "@/design/layout/SplashOverlay";
import "@/features/distance/backgroundTask";
import { useLocationSync } from "@/features/distance/useLocationSync";
import { useSyncLifecycle, useRealtimeEffects } from "@/features/widgetSync/useSyncLifecycle";
import { useDeepLinks } from "@/features/widgetSync/useDeepLinks";
import { useWidgetSync } from "@/features/widgetSync/useWidgetSync";
import { preloadSounds } from "@/lib/sound";
import { useCelebrated } from "@/state/celebratedStore";
import { useCouple } from "@/state/coupleStore";
import { useSettings } from "@/state/settingsStore";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { colors, dark } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useSettings((s) => s.hydrated);
  const onboardingDone = useSettings((s) => s.onboardingDone);
  useWidgetSync();
  useLocationSync();
  useSyncLifecycle();
  useRealtimeEffects();
  useDeepLinks();

  // Primo avvio: onboarding. Dopo, mai più (finché non lo si rivede da "Noi").
  useEffect(() => {
    if (!hydrated) return;
    const inOnboarding = segments[0] === "onboarding";
    if (!onboardingDone && !inOnboarding) router.replace("/onboarding");
    if (onboardingDone && inOnboarding) router.replace("/");
  }, [hydrated, onboardingDone, segments, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          // Pagine con tasto indietro: spinta da destra, swipe indietro dal bordo, fondo carta sempre sotto (nessun lampo bianco).
          animation: "slide_from_right",
          gestureEnabled: true,
          contentStyle: { backgroundColor: colors.ground },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        <Stack.Screen name="design-lab" options={{ presentation: "card" }} />
        {/* Sessione 7: pagine con il tasto indietro (swipe di sistema compreso) */}
        <Stack.Screen name="countdown" />
        <Stack.Screen name="question" />
        <Stack.Screen name="memories" />
        <Stack.Screen name="month" />
      </Stack>
      <Grain />
      <HeartBurstLayer />
      <ConfettiLayer />
    </View>
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
  const coupleHydrated = useCouple((s) => s.hydrated);
  const celebratedHydrated = useCelebrated((s) => s.hydrated);
  // Tutto ciò che decide cosa si vede al primo frame è già pronto: font, preferenze, coppia, feste già viste.
  // Niente salti di layout né font che cambiano dopo lo splash.
  // Rete di sicurezza: se un archivio non risponde entro 2,5 s si parte lo stesso (mai uno schermo vuoto per sempre).
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStalled(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const ready = fontsLoaded && ((hydrated && coupleHydrated && celebratedHydrated) || stalled);
  const soundsOn = useSettings((s) => s.sounds);

  // I player dei suoni si preparano una volta, a impostazioni lette (e se li accendi dopo).
  useEffect(() => {
    if (ready && soundsOn) preloadSounds();
  }, [ready, soundsOn]);

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
