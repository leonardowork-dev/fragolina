import React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { MoodSticker, Sheet, StickerPressable, Text, useTheme } from "@/design";
import { motion } from "@/design/tokens";
import { tiltFor } from "@/lib/hash";
import { S } from "@/lib/strings.it";

import { MOOD_IDS, type MoodId } from "./moods";

/**
 * Selettore dell'umore: otto adesivi disegnati, leggermente sfalsati e inclinati (non una griglia di card uguali).
 * Scelta = tick aptico + molla "pop" sull'adesivo, poi il pannello si chiude da solo.
 */
function Option({ mood, index, selected, onPick }: { mood: MoodId; index: number; selected: boolean; onPick: (m: MoodId) => void }) {
  const { colors, reduceMotion } = useTheme();
  const pop = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.18 * pop.get() }] }));
  return (
    <View style={{ width: "25%", alignItems: "center", marginTop: index % 2 === 1 ? 14 : 0, paddingVertical: 6 }}>
      <StickerPressable
        accessibilityLabel={S.moods[mood]}
        accessibilityState={{ selected }}
        haptic="tick"
        onPress={() => {
          if (!reduceMotion) pop.set(withSequence(withTiming(1, { duration: 90 }), withSpring(0, motion.springBouncy)));
          onPick(mood);
        }}
        style={{ alignItems: "center", gap: 6, transform: [{ rotate: `${tiltFor(`mood-${mood}`, 5)}deg` }] }}
      >
        <Animated.View
          style={[
            { padding: 4, borderRadius: 40, backgroundColor: selected ? colors.accent : "transparent" },
            style,
          ]}
        >
          <MoodSticker mood={mood} size={64} />
        </Animated.View>
        <Text variant="caption" align="center" numberOfLines={2} style={{ fontSize: 13, lineHeight: 16 }} maxFontSizeMultiplier={1.3}>
          {S.moods[mood]}
        </Text>
      </StickerPressable>
    </View>
  );
}

export function MoodSheet({ visible, onClose, current, partnerName, onPick }: { visible: boolean; onClose: () => void; current: MoodId; partnerName: string; onPick: (m: MoodId) => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={S.home.moodSheetTitle(partnerName)}>
      <Text variant="body" style={{ marginBottom: 10 }}>
        {S.home.moodSheetHint}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {MOOD_IDS.map((m, i) => (
          <Option key={m} mood={m} index={i} selected={m === current} onPick={onPick} />
        ))}
      </View>
    </Sheet>
  );
}
