import React from "react";

import { Sticker, Text, useTheme } from "@/design";
import { S } from "@/lib/strings.it";
import { useCouple } from "@/state/coupleStore";

/** Stato del collegamento: appare solo se serve (senza rete, in coda, prova locale). Mai quando va tutto bene. */
export function LinkBadge() {
  const { colors } = useTheme();
  const link = useCouple((s) => s.link);
  const queued = useCouple((s) => s.queue.length);
  const kind = useCouple((s) => s.backendKind);
  const paired = useCouple((s) => !!s.coupleId);
  let text: string | null = null;
  let fill = colors.butter;
  if (link === "offline") text = S.link.offlineQueued(queued).replace(" · 0 in attesa", "");
  else if (queued > 0) text = S.link.offlineQueued(queued).replace("Senza rete · ", "");
  else if (link === "connecting" && paired) text = S.link.connecting;
  else if (kind === "mock") {
    text = S.link.mock;
    fill = colors.skySoft;
  }
  if (link === "offline") text = queued > 0 ? S.link.offlineQueued(queued) : S.link.offline;
  if (!text) return null;
  return (
    <Sticker
      id="link-badge"
      fill={fill}
      radius={14}
      offset={2}
      padding={0}
      tiltMax={1.5}
      accessibilityRole="text"
      accessibilityLabel={text}
    >
      <Text
        variant="caption"
        style={{ paddingHorizontal: 10, paddingVertical: 5, fontSize: 14, lineHeight: 18 }}
        maxFontSizeMultiplier={1.3}
      >
        {text}
      </Text>
    </Sticker>
  );
}
