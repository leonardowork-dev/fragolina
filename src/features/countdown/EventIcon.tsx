import React from "react";
import Svg, { Path } from "react-native-svg";

import { palette } from "@/design/tokens";
import { type EventIconId, type IconFill, ICON_SHAPES } from "@/lib/countdown/icons";

const FILL: Record<IconFill, string> = {
  strawberry: palette.strawberry,
  butter: palette.butter,
  sky: palette.sky,
  leaf: palette.leaf,
  blush: palette.blush,
  paper: palette.paper,
  ink: palette.ink,
  none: "none",
};

/** Simbolo del conto alla rovescia: gli stessi tracciati del widget (src/lib/countdown/icons.json), tratto inchiostro tondo. */
export function EventIcon({ id, size = 40 }: { id: EventIconId; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {ICON_SHAPES[id].map((s, i) => (
        <Path key={i} d={s.d} fill={FILL[s.fill]} stroke={palette.ink} strokeWidth={5.5} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </Svg>
  );
}
