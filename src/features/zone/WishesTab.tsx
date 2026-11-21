import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Button, Chip, Sheet, Sticker, Text, TextField, useTheme } from "@/design";
import { haptics } from "@/lib/haptics";
import { play } from "@/lib/sound";
import { S } from "@/lib/strings.it";
import { uuid } from "@/lib/uuid";
import { DECK, DECK_BY_ID } from "@/lib/zone/deck";
import type { IdeaLevel } from "@/lib/zone/types";
import { useCouple } from "@/state/coupleStore";
import { selectZoneView, useZone } from "@/state/zoneStore";

import { useHeat } from "./heatStore";
import { HeartArt, LipsArt } from "./ZoneArt";

type Card = { id: string; text: string; level: IdeaLevel; own: boolean };

/** Lista dei desideri a sorpresa. Il match arriva SOLO dal server e solo se l'hanno scelto entrambi. */
export function WishesTab() {
  const { colors } = useTheme();
  const role = useCouple((s) => s.myRole);
  const zone = useZone();
  const view = useMemo(() => selectZoneView(zone, role, zone.snapshot.now || 1), [zone, role]);
  const [level, setLevel] = useState<IdeaLevel | "all">("all");
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [lv, setLv] = useState<IdeaLevel>("dolce");
  const seen = useRef<Set<string> | null>(null);

  const cards: Card[] = useMemo(
    () => [...DECK.map((d) => ({ ...d, own: false })), ...view.customIdeas.map((i) => ({ id: i.id, text: i.text, level: i.level, own: i.mine }))],
    [view.customIdeas],
  );
  const matches = view.matches;
  const textOf = (id: string) => DECK_BY_ID.get(id)?.text ?? view.customIdeas.find((i) => i.id === id)?.text ?? "";

  // un match NUOVO (non visto prima) fa "smack" con coriandoli rossi
  useEffect(() => {
    if (!zone.loaded) return;
    if (seen.current === null) {
      seen.current = new Set(matches);
      return;
    }
    const fresh = matches.find((m) => !seen.current!.has(m));
    seen.current = new Set(matches);
    if (fresh) {
      haptics.success();
      play("festa");
      useHeat.getState().fire("match", S.zone.wishesMatch);
    }
  }, [matches, zone.loaded]);

  const picked = new Set(view.wishesMine);
  const toggle = (id: string) => zone.enqueue({ kind: "wish", idea: id, on: !picked.has(id) });
  const list = cards.filter((c) => level === "all" || c.level === level);

  return (
    <View style={{ gap: 14 }}>
      <Text variant="title" accessibilityRole="header">{S.zone.wishesTitle}</Text>
      <Text variant="body">{S.zone.wishesBody}</Text>
      <Sticker id="wish-matches" fill={colors.accent} radius={26} offset={5} padding={16} tiltMax={1} style={{ marginRight: 6 }}>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <LipsArt size={44} />
            <Text variant="title" style={{ color: "#FFF" }}>{S.zone.wishesMatches}</Text>
          </View>
          {matches.length === 0 ? <Text variant="body" style={{ color: "#FFF" }}>{S.zone.wishesNone}</Text> : matches.map((m) => (
            <View key={m} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <HeartArt size={18} fill="#FFF" />
              <Text variant="bodyStrong" style={{ color: "#FFF", flex: 1 }}>{textOf(m)}</Text>
            </View>
          ))}
        </View>
      </Sticker>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip id="lv-all" label={S.zone.levelAll} selected={level === "all"} onPress={() => setLevel("all")} />
        {(["dolce", "piccante", "audace"] as const).map((l) => <Chip key={l} id={`lv-${l}`} label={S.zone.levels[l]} selected={level === l} onPress={() => setLevel(l)} />)}
      </View>
      <Button label={S.zone.ideaAdd} variant="secondary" onPress={() => setAdding(true)} />
      {list.map((c) => {
        const on = picked.has(c.id);
        return (
          <Sticker key={c.id} id={`wish-${c.id}`} fill={on ? colors.blush : colors.surface} radius={20} offset={3} padding={14} tiltMax={1} onPress={() => toggle(c.id)} haptic="tick" accessibilityLabel={`${c.text}. ${on ? S.zone.ideaPicked : S.zone.ideaPick}`} style={{ marginRight: 6 }}>
            <View style={{ gap: 4 }}>
              <Text variant="caption">{S.zone.levels[c.level]}{c.id.startsWith("c-") ? ` · ${S.zone.ideaOwn}` : ""}</Text>
              <Text variant="bodyStrong">{c.text}</Text>
              <Text variant="caption">{on ? `✓ ${S.zone.ideaPicked}` : S.zone.ideaPick}</Text>
              {c.own ? <Button label={S.zone.ideaDelete} variant="ghost" onPress={() => zone.enqueue({ kind: "ideaDelete", id: c.id.slice(2) })} /> : null}
            </View>
          </Sticker>
        );
      })}
      <Sheet visible={adding} onClose={() => setAdding(false)} title={S.zone.ideaAdd}>
        <View style={{ gap: 12, marginTop: 8 }}>
          <Text variant="caption">{S.zone.ideaAddBody}</Text>
          <TextField label={S.zone.ideaText} value={text} onChange={setText} maxLength={80} autoCapitalize="sentences" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["dolce", "piccante", "audace"] as const).map((l) => <Chip key={l} id={`nl-${l}`} label={S.zone.levels[l]} selected={lv === l} onPress={() => setLv(l)} />)}
          </View>
          <Button label={S.zone.ideaSave} disabled={text.trim().length < 3} onPress={() => { zone.enqueue({ kind: "ideaAdd", id: uuid(), text: text.trim(), level: lv }); setText(""); setAdding(false); }} />
        </View>
      </Sheet>
    </View>
  );
}
