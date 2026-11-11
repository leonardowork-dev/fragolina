import React from "react";
import { Image, View } from "react-native";

/**
 * Grana di carta: tile PNG statico ripetuto sopra il fondo, 3.5% di opacità. Non intercetta i tocchi.
 * Il tile si rigenera con `npm run icons` (scripts/make-icon.mjs).
 */
export function Grain() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        opacity: 0.035,
        zIndex: 900,
      }}
    >
      <Image
        source={require("../../../assets/grain.png")}
        resizeMode="repeat"
        style={{ width: "100%", height: "100%" }}
        accessibilityElementsHidden
      />
    </View>
  );
}
