import React from "react";
import { View } from "react-native";

import { Button, Sticker, Text, useTheme, useToast } from "@/design";
import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";

import { copyText, shareText } from "./clipboard";

/** Il codice di coppia come adesivo grande (Bagel, spaziato), con "Copia" (aptica + avviso) e "Condividi" (foglio di sistema). */
export function CodeSticker({ code, dim }: { code: string; dim?: boolean }) {
  const { colors } = useTheme();
  const toast = useToast();
  return (
    <View style={{ gap: 14 }}>
      <Sticker
        id="codice"
        fill={dim ? colors.blushSoft : colors.butter}
        radius={28}
        offset={6}
        padding={18}
        tiltMax={1.6}
      >
        <View
          style={{ gap: 4 }}
          accessible
          accessibilityLabel={`${S.pairing.yourCode}: ${code.split("").join(" ")}`}
        >
          <Text variant="caption">{S.pairing.yourCode}</Text>
          <Text
            variant="hero"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={{ letterSpacing: 6, opacity: dim ? 0.45 : 1 }}
            maxFontSizeMultiplier={1.1}
          >
            {code}
          </Text>
        </View>
      </Sticker>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button
            label={S.pairing.copy}
            variant="secondary"
            disabled={dim}
            haptic="success"
            onPress={async () => {
              if (await copyText(code)) toast.show(S.pairing.copied);
              else haptics.light();
            }}
            fullWidth
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={S.pairing.share}
            disabled={dim}
            onPress={() => void shareText(S.pairing.shareMessage(code, S.appName))}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}
