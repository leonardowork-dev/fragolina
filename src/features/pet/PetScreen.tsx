import React, { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Ellipse, G, Path } from "react-native-svg";

import { Sticker, Text, useTheme } from "@/design";
import { Screen } from "@/design/layout/Screen";
import { motion, palette } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";

/** Pet: l'uovo dorme. Toccarlo lo fa ondeggiare (molla) e lui borbotta. Nessun dato, nessuna pressione. */
const EGG =
  "M110 18 C160 18 198 92 198 148 C198 202 160 232 110 232 C60 232 22 202 22 148 C22 92 60 18 110 18 Z";

function Egg({ size }: { size: number }) {
  const ink = palette.ink;
  const sw = (2.5 * 220) / size;
  const line = {
    stroke: ink,
    strokeWidth: sw * 1.6,
    strokeLinecap: "round" as const,
    fill: "none",
  };
  return (
    <Svg width={size} height={size * (250 / 220)} viewBox="0 0 220 250">
      <G transform="translate(8 8)">
        <Path d={EGG} fill={ink} stroke={ink} strokeWidth={sw} />
      </G>
      <Path
        d={EGG}
        fill={palette.butterSoft}
        stroke={ink}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      <Ellipse
        cx={62}
        cy={96}
        rx={15}
        ry={11}
        fill={palette.strawberry}
        stroke={ink}
        strokeWidth={sw * 0.7}
        transform="rotate(-18 62 96)"
      />
      <Ellipse
        cx={156}
        cy={72}
        rx={11}
        ry={8}
        fill={palette.sky}
        stroke={ink}
        strokeWidth={sw * 0.7}
        transform="rotate(14 156 72)"
      />
      <Ellipse
        cx={164}
        cy={176}
        rx={14}
        ry={10}
        fill={palette.leaf}
        stroke={ink}
        strokeWidth={sw * 0.7}
        transform="rotate(-8 164 176)"
      />
      <Ellipse
        cx={56}
        cy={190}
        rx={10}
        ry={7}
        fill={palette.butter}
        stroke={ink}
        strokeWidth={sw * 0.7}
      />
      <Path d="M70 140 Q82 152 94 140" {...line} />
      <Path d="M126 140 Q138 152 150 140" {...line} />
      <Ellipse cx={62} cy={160} rx={11} ry={7} fill={palette.blush} />
      <Ellipse cx={158} cy={160} rx={11} ry={7} fill={palette.blush} />
      <Path d="M102 164 Q110 169 118 164" {...line} />
      <Path d="M180 14 h15 l-15 17 h15" {...line} strokeWidth={sw * 1.3} />
    </Svg>
  );
}

export function PetScreen() {
  const { colors, reduceMotion } = useTheme();
  const rot = useSharedValue(0);
  const sy = useSharedValue(1);
  const [poke, setPoke] = useState(0);
  const count = useRef(0);

  const onPoke = () => {
    haptics.light();
    count.current += 1;
    setPoke(count.current);
    if (reduceMotion) return;
    rot.set(
      withSequence(
        withTiming(-9, { duration: 80, easing: motion.easeOut }),
        withTiming(7, { duration: 120, easing: motion.easeInOut }),
        withTiming(-4, { duration: 110, easing: motion.easeInOut }),
        withSpring(0, motion.springBouncy),
      ),
    );
    sy.set(withSequence(withTiming(0.94, { duration: 80 }), withSpring(1, motion.springBouncy)));
  };

  const eggStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 0 }, { rotate: `${rot.get()}deg` }, { scaleY: sy.get() }],
  }));
  const line = poke === 0 ? S.pet.body : S.pet.poked[(poke - 1) % S.pet.poked.length]!;

  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        {S.pet.title}
      </Text>
      <View style={{ alignItems: "center", marginTop: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${S.pet.title}. ${S.pet.body}`}
          onPress={onPoke}
          hitSlop={10}
          style={{ transformOrigin: "50% 100%" }}
        >
          <Animated.View style={[eggStyle, { transformOrigin: "50% 100%" }]}>
            <Egg size={300} />
          </Animated.View>
        </Pressable>
      </View>
      <Sticker
        id="uovo-parla"
        fill={colors.sky}
        radius={22}
        offset={4}
        padding={16}
        tiltMax={2}
        style={{ alignSelf: "flex-end", maxWidth: "88%" }}
        accessibilityRole="text"
      >
        <Text variant="bodyStrong" accessibilityLiveRegion="polite">
          {line}
        </Text>
      </Sticker>
      <Text variant="body">{S.pet.hint}</Text>
    </Screen>
  );
}
