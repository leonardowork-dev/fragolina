import React, { useState } from "react";
import { TextInput, View } from "react-native";

import { Button, Sheet, StickerPressable, Text, useTheme } from "@/design";
import { fonts, outline } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";
import { daysInMonth, monthName, toIso } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";

/** Modifica nomi e data di inizio. Nomi: max 24 caratteri. Data: tre stepper con tick aptico. */
function Field({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        maxLength={24}
        accessibilityLabel={label}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        style={{
          fontFamily: fonts.bodySemi,
          fontSize: 17,
          minHeight: 52,
          paddingHorizontal: 16,
          color: colors.ink,
          backgroundColor: colors.blushSoft,
          borderRadius: 16,
          borderWidth: outline.width,
          borderColor: error ? colors.accentInk : colors.outline,
        }}
      />
      {error ? (
        <Text variant="caption" color={colors.accentInk}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function Stepper({
  label,
  text,
  onDec,
  onInc,
}: {
  label: string;
  text: string;
  onDec: () => void;
  onInc: () => void;
}) {
  const { colors } = useTheme();
  const btn = (sign: string, onPress: () => void, a11y: string) => (
    <StickerPressable
      accessibilityLabel={a11y}
      haptic="tick"
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.butter,
        borderWidth: outline.width,
        borderColor: colors.outline,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text variant="title" style={{ lineHeight: 26 }} maxFontSizeMultiplier={1}>
        {sign}
      </Text>
    </StickerPressable>
  );
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
      <Text variant="caption">{label}</Text>
      <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit style={{ minHeight: 24 }}>
        {text}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {btn("−", onDec, `${label} −`)}
        {btn("+", onInc, `${label} +`)}
      </View>
    </View>
  );
}

/** Il form si monta ogni volta che lo Sheet si apre (lo Sheet smonta i figli a chiusura): parte sempre dai dati veri. */
function EditForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const couple = useCouple();
  const [initY, initM, initD] = couple.startDate.split("-").map(Number);
  const [me, setMe] = useState(couple.meName);
  const [partner, setPartner] = useState(couple.partnerName);
  const [y, setY] = useState(initY || 2025);
  const [m, setM] = useState(initM || 1);
  const [d, setD] = useState(initD || 1);
  const [error, setError] = useState<string | null>(null);

  const nowY = new Date().getFullYear();
  const clampDay = (yy: number, mm: number, dd: number) => Math.min(dd, daysInMonth(yy, mm));
  const setMonth = (nm: number) => {
    const wrapped = ((nm - 1 + 12) % 12) + 1;
    setM(wrapped);
    setD((dd) => clampDay(y, wrapped, dd));
  };
  const setYear = (ny: number) => {
    const c = Math.max(1990, Math.min(nowY, ny));
    setY(c);
    setD((dd) => clampDay(c, m, dd));
  };
  const setDay = (nd: number) => {
    const max = daysInMonth(y, m);
    setD(nd < 1 ? max : nd > max ? 1 : nd);
  };

  const save = () => {
    if (!me.trim() || !partner.trim()) {
      setError(S.us.nameEmpty);
      haptics.light();
      return;
    }
    couple.setNames(me.trim(), partner.trim());
    couple.setStartDate(toIso(y, m, d));
    onSaved();
    onClose();
  };

  return (
    <View style={{ gap: 14, marginTop: 8 }}>
      <Field label={S.us.yourName} value={me} onChange={setMe} error={!me.trim() ? error : null} />
      <Field
        label={S.us.partnerName}
        value={partner}
        onChange={setPartner}
        error={!partner.trim() ? error : null}
      />
      <Text variant="caption">{S.us.since}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stepper
          label={S.us.day}
          text={String(d)}
          onDec={() => setDay(d - 1)}
          onInc={() => setDay(d + 1)}
        />
        <Stepper
          label={S.us.month}
          text={monthName(m)}
          onDec={() => setMonth(m - 1)}
          onInc={() => setMonth(m + 1)}
        />
        <Stepper
          label={S.us.year}
          text={String(y)}
          onDec={() => setYear(y - 1)}
          onInc={() => setYear(y + 1)}
        />
      </View>
      <Button label={S.common.save} onPress={save} haptic="success" fullWidth />
    </View>
  );
}

export function EditCoupleSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={S.us.editTitle}>
      <EditForm onClose={onClose} onSaved={onSaved} />
    </Sheet>
  );
}
