import React from "react";

import { Sticker, Text, useTheme, useToast } from "@/design";
import { replayMemories } from "@/lib/memories/sync";
import type { NoteContent } from "@/lib/note/rules";
import { S } from "@/lib/strings.it";
import { useCouple } from "@/state/coupleStore";

/**
 * "Tieni nei ricordi": mette un biglietto o un disegno nell'album. L'id è quello del biglietto/della partita: tenerlo due
 * volte non lo duplica. Compare solo quando siete collegati; sparisce (diventa "Tenuto nei ricordi") appena tenuto.
 */
export function KeepButton({
  id,
  kind,
  source,
  caption,
  content,
  disabled,
}: {
  id: string;
  kind: "draw" | "text";
  source: "note" | "game";
  caption: string;
  content: NoteContent;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const paired = useCouple((s) => !!s.coupleId);
  const keep = useCouple((s) => s.keepMemory);
  const server = useCouple((s) => s.memoriesServer);
  const queue = useCouple((s) => s.queue);
  const userId = useCouple((s) => s.userId);
  const kept = replayMemories(server, queue, userId ?? "", 0).some((m) => m.id === id);
  if (!paired) return null;
  const off = kept || disabled;
  return (
    <Sticker
      id={`keep-${id}`}
      fill={kept ? colors.leaf : colors.butterSoft}
      radius={999}
      offset={off ? 0 : 3}
      padding={0}
      tiltMax={1}
      onPress={
        off
          ? undefined
          : () => {
              if (keep({ id, kind, source, caption, content }).ok) toast.show(S.memories.kept);
            }
      }
      haptic="success"
      accessibilityLabel={kept ? S.memories.kept : S.memories.keep}
      accessibilityHint={disabled && !kept ? S.memories.keepNotYet : undefined}
      style={{ alignSelf: "flex-start", opacity: disabled && !kept ? 0.5 : 1 }}
      testID={`keep-${source}`}
    >
      <Text variant="caption" style={{ paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 }}>
        {kept ? S.memories.kept : S.memories.keep}
      </Text>
    </Sticker>
  );
}
