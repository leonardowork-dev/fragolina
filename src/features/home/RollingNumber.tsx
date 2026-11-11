import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/design/primitives/Text";
import { useTheme } from "@/design/ThemeProvider";
import type { TypeVariant } from "@/design/tokens";

/**
 * Contatore "a rullo" (stile contachilometri): alla PRIMA visualizzazione ogni cifra scorre fino al valore con una
 * piccola sfalsatura; poi resta testo normale. È tutto transform sul thread UI: nessun setState per frame.
 * Altezze e larghezze delle cifre sono misurate (Dynamic Type safe). Con "Meno movimento": mostra subito il valore.
 * Uso: <RollingNumber value={412} variant="hero" />
 */
let alreadyPlayed = false;

function Column({
  digit,
  lineH,
  width,
  index,
  play,
  variant,
  sizeStyle,
}: {
  digit: number;
  lineH: number;
  width: number;
  index: number;
  play: boolean;
  variant: TypeVariant;
  sizeStyle?: object;
}) {
  const y = useSharedValue(play ? 0 : -digit * lineH);
  useEffect(() => {
    if (!play) return;
    y.set(
      withDelay(
        index * 70,
        withTiming(-digit * lineH, {
          duration: 900 + digit * 40,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
        }),
      ),
    );
  }, [play, digit, lineH, index, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <View style={{ height: lineH, width, overflow: "hidden", alignItems: "center" }}>
      <Animated.View style={style}>
        {Array.from({ length: 10 }, (_, d) => (
          <Text key={d} variant={variant} style={[sizeStyle, { height: lineH }]} numberOfLines={1}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

export function RollingNumber({
  value,
  variant = "hero",
  size,
}: {
  value: number;
  variant?: TypeVariant;
  size?: number;
}) {
  const { reduceMotion } = useTheme();
  const str = String(Math.max(0, Math.floor(value)));
  const digits = str.split("").map(Number);
  const [lineH, setLineH] = useState(0);
  const [widths, setWidths] = useState<number[]>([]);
  const [rolling, setRolling] = useState(!alreadyPlayed && !reduceMotion);
  const started = useRef(false);
  const sizeStyle = size
    ? { fontSize: size, lineHeight: Math.round(size * 1.0), letterSpacing: size * -0.03 }
    : undefined;

  const measured = lineH > 0 && widths.filter((w) => w > 0).length === digits.length;

  useEffect(() => {
    if (!rolling || !measured || started.current) return;
    started.current = true;
    alreadyPlayed = true;
    const t = setTimeout(() => setRolling(false), 900 + 9 * 40 + digits.length * 70 + 120);
    return () => clearTimeout(t);
  }, [rolling, measured, digits.length]);

  const showColumns = rolling && measured;
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={str}>
      {/* Testo finale sempre nel flusso: riserva lo spazio esatto, nessun salto di layout. */}
      <Text
        variant={variant}
        style={[sizeStyle, { opacity: showColumns ? 0 : 1 }]}
        numberOfLines={1}
      >
        {str}
      </Text>
      {rolling ? (
        <>
          {/* Misura invisibile: altezza di riga e larghezza di ogni cifra finale. */}
          <View
            style={{ position: "absolute", opacity: 0, flexDirection: "row" }}
            pointerEvents="none"
            accessibilityElementsHidden
          >
            {digits.map((d, i) => (
              <Text
                key={i}
                variant={variant}
                style={sizeStyle}
                numberOfLines={1}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  setLineH((h) => (h === height ? h : height));
                  setWidths((ws) => {
                    if (ws[i] === width) return ws;
                    const n = [...ws];
                    n[i] = width;
                    return n;
                  });
                }}
              >
                {d}
              </Text>
            ))}
          </View>
          {showColumns ? (
            <View
              style={{ position: "absolute", left: 0, top: 0, flexDirection: "row" }}
              accessibilityElementsHidden
              pointerEvents="none"
            >
              {digits.map((d, i) => (
                <Column
                  key={i}
                  digit={d}
                  lineH={lineH}
                  width={widths[i] ?? 0}
                  index={i}
                  play
                  variant={variant}
                  sizeStyle={sizeStyle}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
