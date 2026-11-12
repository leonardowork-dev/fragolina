import React, { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Text, useTheme } from "@/design";
import { fonts, motion, outline } from "@/design/tokens";
import { CODE_LENGTH, cleanCodeInput, extractCode } from "@/lib/joinCode";
import { S } from "@/lib/strings.it";

/**
 * Codice a sei caselle. Sotto c'è UN solo campo di testo invisibile (così incolla, correzione automatica e tastiera
 * funzionano ovunque); le caselle mostrano i caratteri e la casella attiva avanza da sola.
 * Errore: le caselle tremano (easeOut, ±8px) e il contorno diventa rosso; con "Meno movimento" niente tremolio,
 * resta il contorno rosso più il testo sotto.
 */
export function CodeInput({
  value,
  onChange,
  onSubmit,
  error,
  errorSeq,
  autoFocus,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  onSubmit?: () => void;
  error?: boolean;
  /** Cambia a ogni nuovo errore: fa ripartire il tremolio anche se l'errore è lo stesso. */
  errorSeq?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const { colors, reduceMotion } = useTheme();
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const x = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!error || reduceMotion) return;
    const d = 55;
    x.set(
      withSequence(
        withTiming(-8, { duration: d, easing: motion.easeOut }),
        withTiming(8, { duration: d * 2, easing: motion.easeOut }),
        withTiming(-6, { duration: d * 2, easing: motion.easeOut }),
        withTiming(4, { duration: d * 2, easing: motion.easeOut }),
        withTiming(0, { duration: d, easing: motion.easeOut }),
      ),
    );
  }, [errorSeq, error, reduceMotion, x]);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  const active = Math.min(value.length, CODE_LENGTH - 1);
  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      accessibilityRole="none"
      accessible={false}
      style={{ minHeight: 64 }}
    >
      <Animated.View style={[{ flexDirection: "row", gap: 8 }, shake]}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const ch = value[i] ?? "";
          const isActive = focused && i === active && !disabled;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                aspectRatio: 0.82,
                maxHeight: 76,
                borderRadius: 16,
                borderWidth: outline.width,
                borderColor: error ? colors.accentInk : colors.outline,
                backgroundColor: isActive ? colors.butter : ch ? colors.surface : colors.blushSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                variant="display"
                style={{ fontSize: 34, lineHeight: 40 }}
                maxFontSizeMultiplier={1.1}
              >
                {ch}
              </Text>
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) =>
          onChange(t.length > CODE_LENGTH ? extractCode(t) || cleanCodeInput(t) : cleanCodeInput(t))
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        editable={!disabled}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        keyboardType="default"
        returnKeyType="go"
        textContentType="oneTimeCode"
        caretHidden
        selectionColor="transparent"
        accessibilityLabel={S.pairing.codeLabel}
        accessibilityHint={S.a11y.codeBox}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          opacity: 0.02,
          fontFamily: fonts.display,
          fontSize: 34,
          color: "transparent",
        }}
      />
    </Pressable>
  );
}
