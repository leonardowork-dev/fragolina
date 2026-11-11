import { Tabs } from "expo-router";
import React from "react";

import { TabBar } from "@/design/layout/TabBar";

/** Cinque tab con barra personalizzata. Nessuna animazione tra le tab (peer, non gerarchia). */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: "none",
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="pet" />
      <Tabs.Screen name="draw" />
      <Tabs.Screen name="play" />
      <Tabs.Screen name="us" />
    </Tabs>
  );
}
