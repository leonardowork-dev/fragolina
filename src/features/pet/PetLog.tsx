import React from "react";
import { View } from "react-native";

import { Text, useTheme } from "@/design";
import type { Member } from "@/lib/sync/types";
import type { PetLogView } from "@/lib/pet/sync";
import { S } from "@/lib/strings.it";
import { timeAgo } from "@/lib/time";

/** null = sei tu. */
const nameOf = (userId: string, me: string | null, members: Member[], partnerName: string) =>
  userId === me ? null : (members.find((m) => m.userId === userId)?.displayName ?? partnerName);

export function logLine(e: PetLogView, who: string | null): string {
  switch (e.kind) {
    case "feed":
      return S.pet.logLine.feed(who, e.item ? S.pet.foodGiven[e.item] : "un frutto");
    case "cuddle":
      return S.pet.logLine.cuddle(who);
    case "play":
      return S.pet.logLine.play(who);
    case "sleep":
      return S.pet.logLine.sleep(who);
    default:
      return S.pet.logLine.hatch(who);
  }
}

/** "Ultime cure": poche righe di testo con chi e "X fa". Niente card ripetute. */
export function PetLog({
  entries,
  me,
  members,
  partnerName,
  now,
}: {
  entries: PetLogView[];
  me: string | null;
  members: Member[];
  partnerName: string;
  now: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }} accessibilityRole="list">
      <Text variant="title" accessibilityRole="header">
        {S.pet.logTitle}
      </Text>
      {entries.length === 0 ? (
        <Text variant="body">{S.pet.logEmpty}</Text>
      ) : (
        entries.map((e) => (
          <Text key={e.id} variant="body" accessibilityRole="text">
            {logLine(e, nameOf(e.userId, me, members, partnerName))}
            <Text variant="caption" color={colors.ink + "a6"}>
              {"  "}
              {timeAgo(e.at, now)}
            </Text>
          </Text>
        ))
      )}
    </View>
  );
}
