import React from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

import { useTheme } from "../ThemeProvider";
import { outline } from "../tokens";

/**
 * Icone: glifi tozzi con contorno inchiostro, stesso tratto del sistema (2.5px a qualsiasi dimensione).
 * Nessun icon font. Uso: <Icon name="heart" size={24} fill={colors.accent} />
 */
export type IconName = "home" | "pet" | "draw" | "play" | "us" | "heart" | "plus" | "settings" | "check" | "close";

type Props = { name: IconName; size?: number; color?: string; fill?: string };

function gearPath(): string {
  const teeth = 8;
  const rOut = 10;
  const rIn = 7.6;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    const angles = [a0 - step * 0.2, a0 + step * 0.2, a0 + step * 0.3, a0 + step * 0.7];
    const radii = [rOut, rOut, rIn, rIn];
    angles.forEach((a, k) => {
      const r = radii[k]!;
      pts.push(`${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`);
    });
  }
  return `M${pts.join(" L")} Z`;
}
const GEAR = gearPath();

export function Icon({ name, size = 24, color, fill }: Props) {
  const { colors } = useTheme();
  const ink = color ?? colors.ink;
  const f = fill ?? "none";
  const sw = (outline.width * 24) / size;
  const common = { stroke: ink, strokeWidth: sw, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

  let body: React.ReactNode;
  switch (name) {
    case "home":
      body = (
        <>
          <Path d="M3.5 11.2 L12 3.8 L20.5 11.2 V19.5 Q20.5 21 19 21 H5 Q3.5 21 3.5 19.5 Z" fill={f} {...common} />
          <Path d="M10 21 V15.5 H14 V21" fill={ink} {...common} />
        </>
      );
      break;
    case "pet":
      body = (
        <>
          <Circle cx={5.8} cy={11} r={2.2} fill={f} {...common} />
          <Circle cx={9.6} cy={6.6} r={2.2} fill={f} {...common} />
          <Circle cx={14.4} cy={6.6} r={2.2} fill={f} {...common} />
          <Circle cx={18.2} cy={11} r={2.2} fill={f} {...common} />
          <Path
            d="M12 11.4 C9 11.4 6.6 14.4 6.6 17 C6.6 19 8.4 19.6 9.6 19.1 C10.6 18.7 11.2 18.5 12 18.5 C12.8 18.5 13.4 18.7 14.4 19.1 C15.6 19.6 17.4 19 17.4 17 C17.4 14.4 15 11.4 12 11.4 Z"
            fill={f}
            {...common}
          />
        </>
      );
      break;
    case "draw":
      body = (
        <>
          <Path d="M4 20.5 L5.2 15 L16 4.2 Q17 3.4 18 4.2 L19.8 6 Q20.6 7 19.8 8 L9 18.8 Z" fill={f} {...common} />
          <Path d="M14 6.2 L17.8 10" {...common} />
          <Path d="M4 20.5 L5.2 15 L9 18.8 Z" fill={ink} {...common} />
        </>
      );
      break;
    case "play":
      body = (
        <>
          <Rect x={3.5} y={3.5} width={17} height={17} rx={4.5} fill={f} {...common} />
          <Circle cx={8.6} cy={8.6} r={1.3} fill={ink} stroke="none" />
          <Circle cx={15.4} cy={8.6} r={1.3} fill={ink} stroke="none" />
          <Circle cx={12} cy={12} r={1.3} fill={ink} stroke="none" />
          <Circle cx={8.6} cy={15.4} r={1.3} fill={ink} stroke="none" />
          <Circle cx={15.4} cy={15.4} r={1.3} fill={ink} stroke="none" />
        </>
      );
      break;
    case "us":
      body = (
        <>
          <Path d="M3 20.5 C3 16.5 5.4 14.2 8.5 14.2 C11.6 14.2 14 16.5 14 20.5 Z" fill={f} {...common} />
          <Circle cx={8.5} cy={8.4} r={3.3} fill={f} {...common} />
          <Path d="M13 20.5 C13 17.2 14.6 15.2 17 15.2 C19.4 15.2 21 17.2 21 20.5 Z" fill={f} {...common} />
          <Circle cx={17} cy={10} r={2.8} fill={f} {...common} />
        </>
      );
      break;
    case "heart":
      body = (
        <Path
          d="M12 21 C5 15.6 3 11.8 3 8.6 C3 5.6 5.2 3.6 7.8 3.6 C9.6 3.6 11.2 4.6 12 6.1 C12.8 4.6 14.4 3.6 16.2 3.6 C18.8 3.6 21 5.6 21 8.6 C21 11.8 19 15.6 12 21 Z"
          fill={f}
          {...common}
        />
      );
      break;
    case "plus":
      body = <Path d="M12 5 V19 M5 12 H19" {...common} />;
      break;
    case "settings":
      body = (
        <>
          <Path d={GEAR} fill={f} {...common} />
          <Circle cx={12} cy={12} r={2.8} fill={ink} stroke="none" />
        </>
      );
      break;
    case "check":
      body = <Path d="M5 12.8 L10 17.5 L19 7" {...common} />;
      break;
    case "close":
      body = <Path d="M6 6 L18 18 M18 6 L6 18" {...common} />;
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G>{body}</G>
    </Svg>
  );
}
