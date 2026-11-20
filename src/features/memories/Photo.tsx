import { Image } from "expo-image";
import React from "react";
import { View } from "react-native";

import { Text, useTheme } from "@/design";
import { S } from "@/lib/strings.it";

import { requestAlbumRefresh } from "./useMemories";

/** Una foto: dal file locale (se è ancora in coda) o dall'URL firmato (con la chiave di cache = percorso, così non si riscarica a ogni nuovo URL). */
export function Photo({ uri, cacheKey, width, height, label, failed }: { uri: string | null; cacheKey: string; width: number; height: number; label: string; failed?: boolean }) {
  const { colors } = useTheme();
  if (!uri) {
    return (
      <View style={{ width, height, backgroundColor: colors.blushSoft, alignItems: "center", justifyContent: "center", padding: 8 }} accessibilityLabel={label}>
        <Text variant="caption" align="center">
          {failed ? S.memories.photoFailed : S.memories.loadingPhoto}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri, cacheKey }}
      style={{ width, height }}
      contentFit="cover"
      transition={0}
      accessibilityLabel={label}
      accessible
      // il file non si carica più (cancellato dall'altra persona?): si rilegge l'album, la foto esce dall'elenco
      onError={() => requestAlbumRefresh()}
    />
  );
}
