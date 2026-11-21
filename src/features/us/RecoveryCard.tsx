import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import { Share, View } from "react-native";

import { Button, Sheet, Sticker, Text, TextField, useTheme, useToast } from "@/design";
import { S } from "@/lib/strings.it";
import { formatLongDate, localDayKey } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";

/** Codice di recupero del posto: si crea PRIMA di cambiare installazione; nella nuova si riscatta. */
export function RecoveryCard() {
  const { colors } = useTheme();
  const toast = useToast();
  const coupleId = useCouple((s) => s.coupleId);
  const make = useCouple((s) => s.makeRecoveryCode);
  const restore = useCouple((s) => s.restoreSeat);
  const [shown, setShown] = useState<{ code: string; expiresAt: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onMake = async () => {
    setBusy(true);
    const r = await make();
    setBusy(false);
    if (r.ok) setShown({ code: r.code, expiresAt: r.expiresAt });
    else toast.show((S.pairing.errors as Record<string, string>)[r.error] ?? S.pairing.errors.unknown);
  };
  const onRestore = async () => {
    setBusy(true);
    setErr(null);
    const r = await restore(code);
    setBusy(false);
    if (r.ok) {
      setOpen(false);
      setCode("");
      toast.show(S.recovery.restoreOk);
    } else setErr(S.recovery.restoreBad);
  };

  return (
    <>
      <Sticker id="recupero" fill={colors.surface} radius={28} offset={4} padding={18} tiltMax={0.8} style={{ marginRight: 14 }}>
        <View style={{ gap: 10 }}>
          <Text variant="title" accessibilityRole="header">{coupleId ? S.recovery.title : S.recovery.restoreTitle}</Text>
          <Text variant="body">{coupleId ? S.recovery.body : S.recovery.restoreBody}</Text>
          {coupleId ? (
            <Button label={S.recovery.make} variant="secondary" onPress={() => void onMake()} disabled={busy} />
          ) : (
            <Button label={S.recovery.restoreAction} variant="secondary" onPress={() => setOpen(true)} />
          )}
        </View>
      </Sticker>
      <Sheet visible={shown !== null} onClose={() => setShown(null)} title={S.recovery.title}>
        <View style={{ gap: 12, marginTop: 8 }}>
          <Text variant="hero" selectable adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: 34 }}>{shown?.code ?? ""}</Text>
          <Text variant="caption">{S.recovery.shown}</Text>
          {shown ? <Text variant="caption">{S.recovery.expires(formatLongDate(localDayKey(new Date(shown.expiresAt))))}</Text> : null}
          <Button label={S.recovery.copy} onPress={() => { if (shown) void Clipboard.setStringAsync(shown.code).then(() => toast.show(S.recovery.copied)); }} />
          <Button label={S.recovery.share} variant="secondary" onPress={() => { if (shown) void Share.share({ message: shown.code }).catch(() => {}); }} />
        </View>
      </Sheet>
      <Sheet visible={open} onClose={() => setOpen(false)} title={S.recovery.restoreTitle}>
        <View style={{ gap: 12, marginTop: 8 }}>
          <TextField label={S.recovery.restoreField} value={code} onChange={(v) => setCode(v.toUpperCase())} maxLength={14} autoCapitalize="characters" error={err} />
          <Button label={S.recovery.restoreAction} onPress={() => void onRestore()} disabled={busy || code.replace(/[^A-Za-z0-9]/g, "").length < 12} />
        </View>
      </Sheet>
    </>
  );
}
