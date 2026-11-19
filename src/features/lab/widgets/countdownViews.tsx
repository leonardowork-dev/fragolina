import React from "react";
import { Text as RNText, View } from "react-native";

import { EventIcon } from "@/features/countdown/EventIcon";
import { palette as P } from "@/design/tokens";
import type { EventIconId } from "@/lib/countdown/icons";
import type { CountdownDisplay } from "@/lib/countdown/widgetModel";

import { StrawberryFace } from "./faces";
import { Box, HeartGlyph, WT } from "./kit";
import { LockFrame } from "./views";

/**
 * Anteprima del widget "Manca poco" (targets/widget/CountdownWidget.swift): piccolo, medio, blocco. Usano lo STESSO
 * modello (`countdownDisplay`) che la prova Swift↔TypeScript confronta con il codice Swift vero.
 */
type R = { report?: (m: string) => void };
const party = (c: CountdownDisplay) => c.view.state === "today" || c.view.state === "now";
const partyWord = (c: CountdownDisplay) => (c.view.state === "now" ? "È ora!" : "Oggi!");
const W = "#FFFFFF";

export function CdEmpty({ compact, report }: { compact: boolean } & R) {
  if (compact)
    return (
      <View style={{ flex: 1, gap: 4 }}>
        <StrawberryFace sleeping size={58} />
        <View style={{ flexGrow: 1 }} />
        <WT t="Niente da aspettare" size={19} font="display" lines={2} min={0.6} flag={report} />
        <WT t="Aggiungi una data in Fragolina." size={12} font="semi" lines={2} min={0.85} flag={report} />
      </View>
    );
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 16 }}>
      <StrawberryFace sleeping size={92} />
      <View style={{ flex: 1, gap: 4 }}>
        <WT t="Niente da aspettare" size={26} font="display" lines={2} min={0.6} flag={report} />
        <WT t="Aggiungi una data in Fragolina." size={14} font="semi" lines={2} min={0.85} flag={report} />
      </View>
    </View>
  );
}

export function CdSmall({ c, report }: { c: CountdownDisplay | null } & R) {
  if (!c) return <CdEmpty compact report={report} />;
  return (
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      <View style={{ position: "absolute", right: 0, top: 0 }}>
        <EventIcon id={c.icon as EventIconId} size={34} />
      </View>
      {party(c) ? (
        <WT t={partyWord(c)} size={34} font="display" min={0.4} tracking={-0.8} flag={report} />
      ) : (
        <>
          <WT t={c.view.big} size={48} font="display" min={0.4} tracking={-1.5} flag={report} />
          <WT t={c.view.unit} size={14} font="heavy" flag={report} />
        </>
      )}
      <View style={{ marginTop: 2 }}>
        <WT t={c.title} size={13} font="heavy" lines={2} min={0.75} flag={report} />
      </View>
      <WT t={c.dateLine} size={10} font="semi" min={0.7} flag={report} />
    </View>
  );
}

export function CdMedium({ c, report }: { c: CountdownDisplay | null } & R) {
  if (!c) return <CdEmpty compact={false} report={report} />;
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 14, alignItems: "center" }}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        {party(c) ? (
          <>
            <WT t={partyWord(c)} size={46} font="display" min={0.4} tracking={-1.2} flag={report} />
            <WT t="Il giorno è arrivato." size={13} font="semi" lines={2} flag={report} />
          </>
        ) : (
          <>
            <WT t={c.view.big} size={58} font="display" min={0.4} tracking={-1.8} flag={report} />
            <WT t={c.view.unit} size={16} font="heavy" flag={report} />
          </>
        )}
      </View>
      <Box fill={party(c) ? P.strawberry : P.butter} radius={22} offset={4} rotation={1.5}>
        <View style={{ width: 132, padding: 9, gap: 2 }}>
          <EventIcon id={c.icon as EventIconId} size={28} />
          <WT t={c.title} size={18} font="display" lines={2} min={0.55} tracking={-0.3} maxW={114} flag={report} />
          <WT t={c.dateLine} size={11} font="semi" min={0.7} maxW={114} flag={report} />
        </View>
      </Box>
    </View>
  );
}

export function CdCircular({ c }: { c: CountdownDisplay | null }) {
  return (
    <LockFrame w={76} h={76} label="cd-circular" round>
      <View style={{ alignItems: "center", width: 60 }}>
        <HeartGlyph size={10} color={W} />
        {c && c.view.big ? (
          <>
            <RNText style={{ color: W, fontSize: 20, fontWeight: "800" }}>{c.view.big}</RNText>
            <RNText style={{ color: W, fontSize: 9, fontWeight: "700" }}>{c.view.unit}</RNText>
          </>
        ) : (
          <RNText style={{ color: W, fontSize: 22, fontWeight: "800" }}>{c ? "!" : "–"}</RNText>
        )}
      </View>
    </LockFrame>
  );
}

export function CdInline({ c, report }: { c: CountdownDisplay | null } & R) {
  const text = !c ? "Manca poco" : c.view.big ? `${c.view.big} ${c.view.unit}: ${c.title}` : `${c.view.unit.charAt(0).toUpperCase()}${c.view.unit.slice(1)}: ${c.title}`;
  return (
    <View testID="w-cd-inline" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <HeartGlyph size={12} color={W} />
      <WT t={text} size={15} font="semi" min={0.7} maxW={235} color={W} flag={report} />
    </View>
  );
}
