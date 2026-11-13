import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";
import { userArt } from "@/lib/userArt.generated";

import { useTheme } from "../ThemeProvider";
import { motion, palette } from "../tokens";
import { type MascotMood, useMascot } from "./useMascot";

/**
 * Mascotte originale: fragola adesivo (corpo tozzo, contorno inchiostro, cappuccio foglia, occhi a punto con
 * riflesso, guance blush, boccuccia, bordo bianco fustellato + ombra dura).
 * Stati: idle (dondolio lento + ammiccamento irregolare ogni 3-5s), happy, sleepy, surprised, love.
 * `reactive` la collega a useMascot (reazioni da qualsiasi punto). Il tocco la fa schiacciare (happy).
 * Se esiste assets/user-art/mascot-custom.png viene usata al posto del disegno.
 * Uso: <Mascot size={160} mood="idle" onPress={…} />
 */
export type MascotProps = {
  size?: number;
  mood?: MascotMood;
  reactive?: boolean;
  /** Dondolio idle. Di base attivo (spento con "Meno movimento"). */
  bob?: boolean;
  /** Tocco: risponde con happy + squish. Di base attivo. */
  tappable?: boolean;
  onPress?: () => void;
  shadow?: boolean;
};

export const BODY =
  "M110 64 C150 48 192 66 188 118 C184 170 146 214 110 222 C74 214 36 170 32 118 C28 66 70 48 110 64 Z";
export const LEAVES = [
  "M110 68 C98 46 102 26 110 14 C118 26 122 46 110 68 Z",
  "M106 70 C82 70 58 60 48 42 C74 38 98 48 106 70 Z",
  "M114 70 C138 70 162 60 172 42 C146 38 122 48 114 70 Z",
  "M104 72 C78 80 54 78 40 64 C62 56 90 58 104 72 Z",
  "M116 72 C142 80 166 78 180 64 C158 56 130 58 116 72 Z",
];
export const SEEDS: [number, number][] = [
  [58, 146],
  [164, 146],
  [84, 180],
  [136, 180],
  [110, 200],
  [66, 106],
  [154, 106],
  [110, 104],
];
export const HEART = "M0 9 C-13 -1 -9 -13 0 -5.5 C9 -13 13 -1 0 9 Z";

function Face({ mood, blink, sw }: { mood: MascotMood; blink: boolean; sw: number }) {
  const ink = palette.ink;
  const cheek = (
    <>
      <Ellipse cx={58} cy={148} rx={14} ry={8.5} fill={palette.blush} />
      <Ellipse cx={162} cy={148} rx={14} ry={8.5} fill={palette.blush} />
    </>
  );
  const line = {
    stroke: ink,
    strokeWidth: sw * 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  if (mood === "happy") {
    return (
      <G>
        {cheek}
        <Path d="M68 130 Q80 112 92 130" {...line} />
        <Path d="M128 130 Q140 112 152 130" {...line} />
        <Path
          d="M94 144 Q110 172 126 144 Z"
          fill={ink}
          stroke={ink}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
        <Ellipse cx={110} cy={159} rx={8} ry={4.5} fill={palette.strawberrySoft} />
      </G>
    );
  }
  if (mood === "sleepy") {
    return (
      <G>
        {cheek}
        <Path d="M68 126 Q80 138 92 126" {...line} />
        <Path d="M128 126 Q140 138 152 126" {...line} />
        <Path d="M103 150 Q110 155 117 150" {...line} />
        <Path d="M160 62 h14 l-14 16 h14" {...line} strokeWidth={sw * 1.2} />
        <Path d="M180 40 h9 l-9 10 h9" {...line} strokeWidth={sw} />
      </G>
    );
  }
  if (mood === "surprised") {
    return (
      <G>
        {cheek}
        <Circle cx={80} cy={124} r={12} fill={ink} />
        <Circle cx={140} cy={124} r={12} fill={ink} />
        <Circle cx={84} cy={119} r={4.5} fill="#fff" />
        <Circle cx={144} cy={119} r={4.5} fill="#fff" />
        <Ellipse cx={110} cy={153} rx={7} ry={9.5} fill={ink} />
      </G>
    );
  }
  if (mood === "love") {
    return (
      <G>
        <Ellipse cx={58} cy={148} rx={15} ry={9.5} fill={palette.strawberrySoft} />
        <Ellipse cx={162} cy={148} rx={15} ry={9.5} fill={palette.strawberrySoft} />
        <G transform="translate(80 124) scale(1.05)">
          <Path d={HEART} fill={ink} />
        </G>
        <G transform="translate(140 124) scale(1.05)">
          <Path d={HEART} fill={ink} />
        </G>
        <Circle cx={76} cy={121} r={2.6} fill="#fff" />
        <Circle cx={136} cy={121} r={2.6} fill="#fff" />
        <Path d="M99 146 Q110 160 121 146" {...line} />
      </G>
    );
  }
  // idle
  return (
    <G>
      {cheek}
      {blink ? (
        <>
          <Path d="M71 128 Q80 133 89 128" {...line} />
          <Path d="M131 128 Q140 133 149 128" {...line} />
        </>
      ) : (
        <>
          <Circle cx={80} cy={126} r={9} fill={ink} />
          <Circle cx={140} cy={126} r={9} fill={ink} />
          <Circle cx={83.5} cy={122.5} r={3.2} fill="#fff" />
          <Circle cx={143.5} cy={122.5} r={3.2} fill="#fff" />
        </>
      )}
      <Path d="M101 145 Q110 154 119 145" {...line} />
    </G>
  );
}

export function Mascot({
  size = 160,
  mood = "idle",
  reactive,
  bob = true,
  tappable = true,
  onPress,
  shadow = true,
}: MascotProps) {
  const { reduceMotion } = useTheme();
  const reaction = useMascot((s) => s.mood);
  const nonce = useMascot((s) => s.nonce);
  const [tapMood, setTapMood] = useState<MascotMood | null>(null);
  const [blink, setBlink] = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shown: MascotMood = tapMood ?? (reactive && reaction ? reaction : mood);

  // Ammiccamento irregolare ogni 3-5s. È un cambio di stato, non un movimento: resta con "Meno movimento".
  useEffect(() => {
    if (shown !== "idle") return;
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(
        () => {
          if (!alive) return;
          setBlink(true);
          setTimeout(() => {
            if (!alive) return;
            setBlink(false);
            schedule();
          }, 130);
        },
        3000 + Math.random() * 2000,
      );
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [shown]);

  // Dondolio lento (idle/sleepy). Loop non guidato dal tocco: bezier, mai ease-in secco.
  const bobY = useSharedValue(0);
  useEffect(() => {
    if (!bob || reduceMotion) {
      bobY.set(0);
      return;
    }
    const slow = shown === "sleepy";
    bobY.set(
      withRepeat(
        withSequence(
          withTiming(-size * 0.025, {
            duration: slow ? 2600 : 1700,
            easing: Easing.bezier(0.45, 0, 0.55, 1),
          }),
          withTiming(0, { duration: slow ? 2600 : 1700, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
        ),
        -1,
      ),
    );
  }, [bob, reduceMotion, shown, size, bobY]);

  // Squish alla reazione/al tocco (azione dell'utente: ammesso il piacere).
  const squish = useSharedValue(0);
  const nonceRef = useRef(nonce);
  useEffect(() => {
    if (nonceRef.current === nonce) return;
    nonceRef.current = nonce;
    if (!reduceMotion)
      squish.set(withSequence(withTiming(1, { duration: 90 }), withSpring(0, motion.springBouncy)));
  }, [nonce, reduceMotion, squish]);

  const anim = useAnimatedStyle(() => {
    const q = squish.get();
    return {
      transform: [
        { translateY: bobY.get() + q * size * 0.02 },
        { scaleX: 1 + 0.1 * q },
        { scaleY: 1 - 0.1 * q },
      ],
    };
  });

  const handlePress = () => {
    haptics.light();
    if (!reduceMotion)
      squish.set(withSequence(withTiming(1, { duration: 90 }), withSpring(0, motion.springBouncy)));
    setTapMood("happy");
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapMood(null), 1200);
    onPress?.();
  };
  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  const h = size * (240 / 220);
  const sw = (2.5 * 220) / size;
  const border = 14;

  const art = (
    <Animated.View style={[{ width: size, height: h }, anim]}>
      {userArt.mascot ? (
        <Image source={userArt.mascot} style={{ width: size, height: size }} contentFit="contain" />
      ) : (
        <Svg width={size} height={h} viewBox="0 0 220 240">
          {shadow ? (
            <G transform="translate(5 5)">
              <Path
                d={BODY}
                fill={palette.ink}
                stroke={palette.ink}
                strokeWidth={border + sw * 2}
                strokeLinejoin="round"
              />
              {LEAVES.map((d, i) => (
                <Path
                  key={i}
                  d={d}
                  fill={palette.ink}
                  stroke={palette.ink}
                  strokeWidth={border + sw * 2}
                  strokeLinejoin="round"
                />
              ))}
            </G>
          ) : null}
          <Path
            d={BODY}
            fill={palette.ink}
            stroke={palette.ink}
            strokeWidth={border + sw * 2}
            strokeLinejoin="round"
          />
          {LEAVES.map((d, i) => (
            <Path
              key={i}
              d={d}
              fill={palette.ink}
              stroke={palette.ink}
              strokeWidth={border + sw * 2}
              strokeLinejoin="round"
            />
          ))}
          <Path d={BODY} fill="#fff" stroke="#fff" strokeWidth={border} strokeLinejoin="round" />
          {LEAVES.map((d, i) => (
            <Path
              key={i}
              d={d}
              fill="#fff"
              stroke="#fff"
              strokeWidth={border}
              strokeLinejoin="round"
            />
          ))}
          <Path
            d={BODY}
            fill={palette.strawberry}
            stroke={palette.ink}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {SEEDS.map(([x, y], i) => (
            <Ellipse
              key={i}
              cx={x}
              cy={y}
              rx={3.4}
              ry={5}
              fill={palette.strawberryDeep}
              transform={`rotate(${(i % 3) * 14 - 14} ${x} ${y})`}
            />
          ))}
          <Path
            d="M52 98 C56 84 68 76 82 72"
            stroke="#fff"
            strokeOpacity={0.7}
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
          />
          {LEAVES.map((d, i) => (
            <Path
              key={i}
              d={d}
              fill={palette.leaf}
              stroke={palette.ink}
              strokeWidth={sw}
              strokeLinejoin="round"
            />
          ))}
          <Face mood={shown} blink={blink} sw={sw} />
        </Svg>
      )}
    </Animated.View>
  );

  if (!tappable) return <View accessibilityElementsHidden>{art}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={S.a11y.mascot}
      hitSlop={8}
      onPress={handlePress}
    >
      {art}
    </Pressable>
  );
}
