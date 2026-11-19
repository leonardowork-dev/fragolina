import React, { useState } from "react";
import { View } from "react-native";

import { Button, Sheet, StickerPressable, StickerSwitch, Sticker, Text, TextField, useTheme } from "@/design";
import { outline } from "@/design/tokens";
import { EVENT_ICONS, type EventIconId } from "@/lib/countdown/icons";
import { type CountdownEvent, TITLE_MAX, cleanTitle } from "@/lib/countdown/rules";
import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";
import { daysInMonth, monthName, toIso } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";

import { Stepper } from "../us/EditCoupleSheet";
import { EventIcon } from "./EventIcon";

/** Il form si monta ogni volta che lo Sheet si apre (parte sempre dai dati veri). */
function Form({ event, defaultDate, onClose, onSaved, onRemoved }: { event: CountdownEvent | null; defaultDate: string; onClose: () => void; onSaved: () => void; onRemoved: () => void }) {
  const { colors } = useTheme();
  const save = useCouple((s) => s.saveEvent);
  const remove = useCouple((s) => s.removeEvent);
  const [init] = useState(() => (event?.date ?? defaultDate).split("-").map(Number));
  const [title, setTitle] = useState(event?.title ?? "");
  const [y, setY] = useState(init[0] ?? 2026);
  const [m, setM] = useState(init[1] ?? 1);
  const [d, setD] = useState(init[2] ?? 1);
  const [hasTime, setHasTime] = useState(event?.time != null);
  const [hh, setHh] = useState(event?.time ? Number(event.time.slice(0, 2)) : 18);
  const [mm, setMm] = useState(event?.time ? Number(event.time.slice(3, 5)) : 0);
  const [icon, setIcon] = useState<EventIconId>(event?.icon ?? "heart");
  const [featured, setFeatured] = useState(event?.featured ?? false);
  const [error, setError] = useState<string | null>(null);
  const [askDelete, setAskDelete] = useState(false);

  const setMonth = (nm: number) => {
    const w = ((nm - 1 + 12) % 12) + 1;
    setM(w);
    setD((x) => Math.min(x, daysInMonth(y, w)));
  };
  const setYear = (ny: number) => {
    const c = Math.max(2000, Math.min(2100, ny));
    setY(c);
    setD((x) => Math.min(x, daysInMonth(c, m)));
  };
  const setDay = (nd: number) => {
    const max = daysInMonth(y, m);
    setD(nd < 1 ? max : nd > max ? 1 : nd);
  };
  const p2 = (n: number) => String(n).padStart(2, "0");

  const submit = () => {
    if (!cleanTitle(title)) {
      setError(S.countdown.titleEmpty);
      haptics.light();
      return;
    }
    const r = save(event?.id ?? null, { title, date: toIso(y, m, d), time: hasTime ? `${p2(hh)}:${p2(mm)}` : null, icon, featured });
    if (!r.ok) {
      setError(r.error === "title" ? S.countdown.titleEmpty : S.pairing.errors.unknown);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <View style={{ gap: 16, marginTop: 8 }}>
      <TextField label={S.countdown.fieldTitle} value={title} onChange={setTitle} maxLength={TITLE_MAX} placeholder={S.countdown.titlePlaceholder} error={!cleanTitle(title) ? error : null} autoCapitalize="sentences" />
      <Text variant="caption">{S.countdown.fieldDate}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stepper label={S.us.day} text={String(d)} onDec={() => setDay(d - 1)} onInc={() => setDay(d + 1)} />
        <Stepper label={S.us.month} text={monthName(m)} onDec={() => setMonth(m - 1)} onInc={() => setMonth(m + 1)} />
        <Stepper label={S.us.year} text={String(y)} onDec={() => setYear(y - 1)} onInc={() => setYear(y + 1)} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{hasTime ? S.countdown.fieldTime : S.countdown.noTime}</Text>
          {!hasTime ? <Text variant="caption">{S.countdown.setTime}</Text> : null}
        </View>
        <StickerSwitch value={hasTime} onChange={setHasTime} label={S.countdown.setTime} />
      </View>
      {hasTime ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Stepper label={S.countdown.hour} text={p2(hh)} onDec={() => setHh((hh + 23) % 24)} onInc={() => setHh((hh + 1) % 24)} />
          <Stepper label={S.countdown.minute} text={p2(mm)} onDec={() => setMm((mm + 55) % 60)} onInc={() => setMm((mm + 5) % 60)} />
        </View>
      ) : null}
      <Text variant="caption">{S.countdown.fieldIcon}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {EVENT_ICONS.map((id) => (
          <StickerPressable
            key={id}
            testID={`icon-${id}`}
            accessibilityLabel={S.countdown.iconNames[id]}
            accessibilityState={{ selected: icon === id }}
            haptic="tick"
            onPress={() => setIcon(id)}
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: icon === id ? colors.butter : colors.blushSoft,
              borderWidth: outline.width,
              borderColor: colors.outline,
              opacity: icon === id ? 1 : 0.8,
            }}
          >
            <EventIcon id={id} size={36} />
          </StickerPressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{S.countdown.featured}</Text>
          <Text variant="caption">{S.countdown.featuredHint}</Text>
        </View>
        <StickerSwitch value={featured} onChange={setFeatured} label={S.countdown.featured} />
      </View>
      <Button id="save-event" label={S.countdown.save} onPress={submit} haptic="success" fullWidth />
      {event ? (
        askDelete ? (
          <Sticker id="delete-ask" fill={colors.blushSoft} radius={20} offset={3} padding={14} tiltMax={1}>
            <View style={{ gap: 10 }}>
              <Text variant="bodyStrong">{S.countdown.deleteAsk(event.title)}</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button id="delete-yes" label={S.countdown.deleteYes} variant="danger" onPress={() => { remove(event.id); onRemoved(); onClose(); }} />
                <Button label={S.countdown.deleteNo} variant="secondary" onPress={() => setAskDelete(false)} />
              </View>
            </View>
          </Sticker>
        ) : (
          <Button id="delete-event" label={S.countdown.delete} variant="ghost" onPress={() => setAskDelete(true)} />
        )
      ) : null}
    </View>
  );
}

export function EventSheet({ visible, event, defaultDate, onClose, onSaved, onRemoved }: { visible: boolean; event: CountdownEvent | null; defaultDate: string; onClose: () => void; onSaved: () => void; onRemoved: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={event ? S.countdown.editTitle : S.countdown.newTitle}>
      <Form event={event} defaultDate={defaultDate} onClose={onClose} onSaved={onSaved} onRemoved={onRemoved} />
    </Sheet>
  );
}
