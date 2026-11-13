import React from "react";
import { Text as RNText, View } from "react-native";

import { BG_HEX, NoteDrawingSvg } from "@/features/draw/NoteArt";
import { fonts, palette as P } from "@/design/tokens";
import type { DistanceWidgetModel, NoteWidgetModel } from "@/lib/note/widgetModel";
import { type NoteStroke, isDraw, textInkFor } from "@/lib/note/rules";
import { S } from "@/lib/strings.it";

import { StrawberryFace } from "./faces";
import { fitText } from "./fit";
import { Box, FONT, HeartGlyph, WT } from "./kit";
import { LockFrame } from "./views";

/**
 * Anteprima dei widget "Biglietto" e "Distanza" (targets/widget/NoteWidget.swift, DistanceWidget.swift): piccolo,
 * medio e blocco. Usano gli STESSI modelli (`noteWidgetModel`, `distanceWidgetModel`) che la prova Swift↔TypeScript
 * confronta con il codice Swift vero. Servono sia a /widget-preview sia all'anteprima dentro la scheda Disegna.
 */
type R = { report?: (m: string) => void };
const Spacer = () => <View style={{ flexGrow: 1 }} />;
const W = "#FFFFFF";

function Card({ m, size, fontSize, w, h }: { m: NoteWidgetModel; size?: number; fontSize: number; w?: number; h?: number }) {
  const n = m.note!;
  if (n.kind === "text" && !isDraw(n.content)) {
    const bg = n.content.bg;
    const bw = (w ?? size ?? 80) - 18 - 5;
    const bh = (h ?? size ?? 80) - 18 - 5;
    // come `minimumScaleFactor(0.35)` + `lineLimit(6)` dentro un riquadro di altezza fissa: il testo rimpicciolisce finché entra
    let fit = fitText(n.content.text, FONT.display, fontSize * 0.35, bw, 6, 1, -0.3);
    for (let sc = 1; sc >= 0.35; sc -= 0.05) {
      const sz = fontSize * sc;
      const maxLines = Math.min(6, Math.max(1, Math.floor(bh / (sz * 1.05))));
      const f = fitText(n.content.text, FONT.display, sz, bw, maxLines, 1, -0.3);
      if (!f.truncated) {
        fit = f;
        break;
      }
    }
    return (
      <Box fill={BG_HEX[bg]} radius={16} offset={3} rotation={-1} style={{ width: w ?? size, height: h ?? size }}>
        <View style={{ padding: 9, flex: 1 }}>
          <WT t={fit.lines.join(" ")} size={fit.size} font="display" lines={6} min={1} tracking={-0.3} color={P[textInkFor(bg)]} maxW={bw} />
        </View>
      </Box>
    );
  }
  const d = isDraw(n.content) ? n.content.strokes : [];
  const s = size ?? Math.min(w ?? 0, h ?? 0);
  return (
    <Box fill={P.white} radius={16} offset={3} style={{ width: s, height: s }}>
      <View style={{ padding: 6 }}>
        <NoteDrawingSvg strokes={d} size={s - 12 - 5} />
      </View>
    </Box>
  );
}

function Empty({ compact, report }: { compact: boolean } & R) {
  if (compact)
    return (
      <View style={{ flex: 1, gap: 4 }}>
        <StrawberryFace mood="felice" size={58} />
        <Spacer />
        <WT t="Niente biglietti" size={19} font="display" lines={2} min={0.6} flag={report} />
        <WT t="Toccami per disegnare." size={12} font="semi" lines={2} min={0.85} flag={report} />
      </View>
    );
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 16 }}>
      <StrawberryFace mood="felice" size={92} />
      <View style={{ flex: 1, gap: 4 }}>
        <WT t="Niente biglietti" size={26} font="display" lines={2} min={0.6} flag={report} />
        <WT t="Toccami per disegnare." size={14} font="semi" lines={2} min={0.85} flag={report} />
      </View>
    </View>
  );
}

const leaves = (m: NoteWidgetModel) => (m.minutesLeft <= 1 ? "sparisce tra meno di un minuto" : `sparisce tra ${m.minutesLeft} min`);

export function NoteSmall({ m, report }: { m: NoteWidgetModel } & R) {
  if (m.state === "empty") return <Empty compact report={report} />;
  return (
    <View style={{ flex: 1, gap: 5 }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {m.note!.kind === "text" ? <Card m={m} w={113} h={94} fontSize={22} /> : <Card m={m} size={94} fontSize={22} />}
      </View>
      <WT t={m.byLine ?? ""} size={11} font="heavy" min={0.6} flag={report} />
    </View>
  );
}

export function NoteMedium({ m, report }: { m: NoteWidgetModel } & R) {
  if (m.state === "empty") return <Empty compact={false} report={report} />;
  const n = m.note!;
  if (n.kind === "text")
    return (
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flex: 1, alignItems: "stretch" }}>
          <Card m={m} w={285} h={92} fontSize={28} />
        </View>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <WT t={m.byLine ?? ""} size={12} font="heavy" min={0.6} flag={report} />
          </View>
          <WT t={leaves(m)} size={10} font="semi" min={0.6} maxW={120} flag={report} />
        </View>
      </View>
    );
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 14, alignItems: "center" }}>
      <Card m={m} size={106} fontSize={20} />
      <View style={{ flex: 1, gap: 4, justifyContent: "flex-end", alignSelf: "stretch" }}>
        <WT t={m.byLine ?? ""} size={14} font="heavy" lines={2} min={0.7} flag={report} />
        <WT t={leaves(m)} size={11} font="semi" lines={2} min={0.8} flag={report} />
      </View>
    </View>
  );
}

export function NoteLock({ m, report }: { m: NoteWidgetModel } & R) {
  if (m.state === "empty")
    return (
      <LockFrame w={172} h={76} label="note-lock-empty">
        <View style={{ width: 160 }}>
          <WT t="Nessun biglietto" size={14} font="heavy" maxW={160} color={W} flag={report} />
          <WT t="Disegna" size={12} font="semi" maxW={160} color={W} flag={report} />
        </View>
      </LockFrame>
    );
  const n = m.note!;
  return (
    <LockFrame w={172} h={76} label="note-lock">
      <View style={{ width: 160 }}>
        {n.kind === "text" && !isDraw(n.content) ? (
          <>
            <WT t={n.content.text} size={14} font="heavy" lines={3} min={0.7} maxW={160} color={W} flag={report} />
            <WT t={m.byLine ?? ""} size={11} font="semi" maxW={160} color={W} flag={report} />
          </>
        ) : (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <NoteDrawingSvg strokes={isDraw(n.content) ? (n.content.strokes as NoteStroke[]) : []} size={54} mono={W} />
            <View style={{ flex: 1 }}>
              <WT t={m.byLine ?? ""} size={12} font="heavy" lines={2} min={0.7} color={W} flag={report} />
              <WT t={leaves(m)} size={11} font="semi" lines={2} min={0.7} color={W} flag={report} />
            </View>
          </View>
        )}
      </View>
    </LockFrame>
  );
}

// ---------- distanza ----------
const stateTitle = (d: DistanceWidgetModel, name: string) =>
  d.state === "hidden" ? S.distance.hidden : d.state === "mine_off" ? S.distance.mineOff : d.state === "none" ? S.distance.none : S.distance.unpaired;
const stateSub = (d: DistanceWidgetModel, name: string) =>
  d.state === "hidden" ? S.distance.hiddenSub(name) : d.state === "mine_off" ? S.distance.mineOffSub : d.state === "none" ? S.distance.noneSub(name) : S.distance.unpairedSub;

export function DistSmall({ d, name, report }: { d: DistanceWidgetModel; name: string } & R) {
  const ok = d.state === "ok";
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <StrawberryFace mood={ok ? "innamorata" : null} sleeping={!ok} size={36} />
        <HeartGlyph size={22} color={P.strawberry} />
      </View>
      <Spacer />
      {ok ? (
        <>
          {d.near ? (
            <WT t={S.distance.near} size={26} font="display" min={0.4} tracking={-0.6} flag={report} />
          ) : (
            <>
              <WT t={d.big} size={44} font="display" min={0.35} tracking={-1.4} flag={report} />
              <WT t={d.unit} size={14} font="heavy" flag={report} />
            </>
          )}
          {d.ageText ? <WT t={d.ageText} size={10} font="semi" min={0.7} flag={report} /> : null}
        </>
      ) : (
        <>
          <WT t={stateTitle(d, name)} size={18} font="display" lines={2} min={0.6} flag={report} />
          <WT t={stateSub(d, name)} size={11} font="semi" lines={3} min={0.8} flag={report} />
        </>
      )}
    </View>
  );
}

export function DistMedium({ d, name, report }: { d: DistanceWidgetModel; name: string } & R) {
  const ok = d.state === "ok";
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14 }}>
      <Box fill={ok ? P.blush : P.skySoft} radius={22} offset={4} rotation={-1.5}>
        <View style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
          <StrawberryFace mood={ok ? "innamorata" : null} sleeping={!ok} size={76} />
        </View>
      </Box>
      <View style={{ flex: 1, gap: 2 }}>
        {ok ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
              {d.near ? (
                <WT t={S.distance.near} size={34} font="display" min={0.4} tracking={-0.8} maxW={150} flag={report} />
              ) : (
                <>
                  <WT t={d.big} size={52} font="display" min={0.35} tracking={-1.6} maxW={110} flag={report} />
                  <WT t={d.unit} size={18} font="heavy" maxW={34} flag={report} />
                </>
              )}
              <HeartGlyph size={22} color={P.strawberry} />
            </View>
            {d.ageText ? <WT t={d.ageText} size={12} font="semi" min={0.7} flag={report} /> : null}
          </>
        ) : (
          <>
            <WT t={stateTitle(d, name)} size={24} font="display" lines={2} min={0.6} flag={report} />
            <WT t={stateSub(d, name)} size={13} font="semi" lines={3} min={0.8} flag={report} />
          </>
        )}
      </View>
    </View>
  );
}

export function DistCircular({ d }: { d: DistanceWidgetModel }) {
  return (
    <LockFrame w={76} h={76} label="dist-circular" round>
      <View style={{ alignItems: "center", width: 60 }}>
        <HeartGlyph size={10} color={W} />
        <RNText style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: W }} numberOfLines={1}>
          {d.state === "ok" && !d.near ? d.big : d.state === "ok" ? "0" : "–"}
        </RNText>
        {d.state === "ok" && !d.near ? <RNText style={{ fontFamily: fonts.bodyBold, fontSize: 9, color: W }}>km</RNText> : null}
      </View>
    </LockFrame>
  );
}

export function DistInline({ d, name, report }: { d: DistanceWidgetModel; name: string } & R) {
  return (
    <View testID="w-dist-inline" style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#3a3340", padding: 6, borderRadius: 8 }}>
      <HeartGlyph size={12} color={W} />
      <WT t={d.state === "ok" ? d.sentence : stateTitle(d, name)} size={15} font="heavy" color={W} maxW={240} flag={report} />
    </View>
  );
}

