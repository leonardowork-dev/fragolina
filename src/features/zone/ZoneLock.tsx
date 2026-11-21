import React, { useEffect, useState } from "react";
import { TextInput, View } from "react-native";

import { Button, Sticker, Text, useTheme } from "@/design";
import { fonts, outline } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";
import { authenticateDevice, biometricsAvailable, checkPin, hasPin, setPin } from "@/lib/zone/auth";
import { isValidPin } from "@/lib/zone/gate";

import { WinkStrawberry } from "./ZoneArt";

/** Porta della zona: Face ID (o codice del telefono); senza, un PIN di 4 cifre dell'app. */
export function ZoneLock({ onOpen }: { onOpen: () => void }) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<"start" | "pin" | "create">("start");
  const [pin, setPinText] = useState("");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    void (async () => {
      if (await biometricsAvailable()) {
        if (await authenticateDevice(S.zone.lockPrompt)) onOpen();
      } else setMode((await hasPin()) ? "pin" : "create");
    })();
    // solo all'apertura della porta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryBio = async () => {
    if (await biometricsAvailable()) {
      if (await authenticateDevice(S.zone.lockPrompt)) onOpen();
      else setMode((await hasPin()) ? "pin" : "create");
    } else setMode((await hasPin()) ? "pin" : "create");
  };
  const submit = async () => {
    if (mode === "create") {
      if (isValidPin(pin) && (await setPin(pin))) {
        haptics.success();
        onOpen();
      } else setWrong(true);
    } else if (await checkPin(pin)) {
      haptics.success();
      onOpen();
    } else {
      setWrong(true);
      setPinText("");
    }
  };

  return (
    <View style={{ gap: 18, alignItems: "center", paddingTop: 30 }}>
      <WinkStrawberry size={130} wink={false} />
      <Sticker id="zone-lock" fill={colors.surface} radius={28} offset={5} padding={20} tiltMax={1} style={{ alignSelf: "stretch", marginRight: 6 }}>
        <View style={{ gap: 12 }}>
          <Text variant="title" accessibilityRole="header">{mode === "create" ? S.zone.pinTitle : S.zone.lockTitle}</Text>
          <Text variant="body">{mode === "create" ? S.zone.pinBody : S.zone.lockBody}</Text>
          {mode !== "start" ? (
            <>
              <TextInput
                value={pin}
                onChangeText={(t) => {
                  setWrong(false);
                  setPinText(t.replace(/\D/g, "").slice(0, 4));
                }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                accessibilityLabel={S.zone.pinEnter}
                placeholder="••••"
                style={{ borderWidth: outline.width, borderColor: colors.outline, borderRadius: 16, backgroundColor: colors.blushSoft ?? colors.surface, paddingHorizontal: 16, paddingVertical: 12, fontSize: 24, letterSpacing: 8, fontFamily: fonts.bodyBold, color: colors.ink, textAlign: "center" }}
              />
              {wrong ? <Text variant="caption" color={colors.accent}>{S.zone.pinWrong}</Text> : null}
              <Button label={mode === "create" ? S.zone.pinSave : S.zone.pinOk} onPress={() => void submit()} disabled={!isValidPin(pin)} />
            </>
          ) : null}
          <Button label={S.zone.lockOpen} variant={mode === "start" ? "primary" : "ghost"} onPress={() => void tryBio()} />
        </View>
      </Sticker>
    </View>
  );
}
