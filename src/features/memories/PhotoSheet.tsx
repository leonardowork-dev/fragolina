import React, { useState } from "react";
import { View } from "react-native";

import { Button, Sheet, Text, TextField, useToast } from "@/design";
import { CAPTION_MAX } from "@/lib/memories/types";
import type { PreparedPhoto } from "@/lib/memories/photoDevice";
import { S } from "@/lib/strings.it";
import { daysInMonth, monthName, toIso } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";

import { Stepper } from "../us/EditCoupleSheet";
import { Photo } from "./Photo";

function Form({ photo, today, onClose }: { photo: PreparedPhoto; today: string; onClose: (saved: boolean) => void }) {
  const toast = useToast();
  const add = useCouple((s) => s.addPhoto);
  const link = useCouple((s) => s.link);
  const [init] = useState(() => today.split("-").map(Number));
  const [caption, setCaption] = useState("");
  const [y, setY] = useState(init[0]!);
  const [m, setM] = useState(init[1]!);
  const [d, setD] = useState(init[2]!);
  const maxYear = init[0]!;
  const setMonth = (nm: number) => {
    const w = ((nm - 1 + 12) % 12) + 1;
    setM(w);
    setD((x) => Math.min(x, daysInMonth(y, w)));
  };
  const setYear = (ny: number) => {
    const c = Math.max(2000, Math.min(maxYear, ny));
    setY(c);
    setD((x) => Math.min(x, daysInMonth(c, m)));
  };
  const setDay = (nd: number) => {
    const max = daysInMonth(y, m);
    setD(nd < 1 ? max : nd > max ? 1 : nd);
  };
  const ratio = photo.w / photo.h;
  const w = 280;
  const h = Math.max(120, Math.min(340, Math.round(w / ratio)));
  return (
    <View style={{ gap: 14, marginTop: 8 }}>
      <View style={{ alignSelf: "center", borderRadius: 16, overflow: "hidden", borderWidth: 2.5 }}>
        <Photo uri={photo.uri} cacheKey="preview" width={w} height={h} label={S.memories.newTitle} />
      </View>
      <TextField label={S.memories.captionLabel} value={caption} onChange={setCaption} maxLength={CAPTION_MAX} placeholder={S.memories.captionPlaceholder} autoCapitalize="sentences" />
      <Text variant="caption">{S.memories.dateLabel}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stepper label={S.us.day} text={String(d)} onDec={() => setDay(d - 1)} onInc={() => setDay(d + 1)} />
        <Stepper label={S.us.month} text={monthName(m)} onDec={() => setMonth(m - 1)} onInc={() => setMonth(m + 1)} />
        <Stepper label={S.us.year} text={String(y)} onDec={() => setYear(y - 1)} onInc={() => setYear(y + 1)} />
      </View>
      <Button
        id="save-photo"
        label={S.memories.save}
        haptic="success"
        fullWidth
        onPress={() => {
          const r = add({ uri: photo.uri, w: photo.w, h: photo.h, bytes: photo.bytes }, caption, toIso(y, m, d));
          if (r.ok) toast.show(link === "offline" ? S.memories.savedQueued : S.memories.saved);
          onClose(r.ok);
        }}
      />
    </View>
  );
}

/** La foto scelta (già ridotta): didascalia corta e giorno, poi "Metti nell'album". */
export function PhotoSheet({ photo, today, onClose }: { photo: PreparedPhoto | null; today: string; onClose: (saved: boolean) => void }) {
  return (
    <Sheet visible={photo !== null} onClose={() => onClose(false)} title={S.memories.newTitle}>
      {photo ? <Form photo={photo} today={today} onClose={onClose} /> : null}
    </Sheet>
  );
}
