import React from "react";
import { Text as RNText, View } from "react-native";

import { palette as P } from "@/design/tokens";

import { Confetti, LockMoodGlyph, StrawberryFace, moodFill } from "./faces";
import { Box, Frame, HeartGlyph, Pill, WT } from "./kit";
import type { PreviewEntry } from "./model";

/** Replica React dei widget SwiftUI (targets/widget/*.swift): stesse misure, stessi testi, stessi stati. */
type R = { e: PreviewEntry; report?: (m: string) => void };
const Spacer = ({ min = 0 }: { min?: number }) => <View style={{ flexGrow: 1, minHeight: min }} />;

function MoodOrPlaceholder({ id, size }: { id: string | null; size: number }) {
  if (id) return <StrawberryFace mood={id} size={size} />;
  const d = size * 0.92;
  return (
    <View style={{ width: size, height: (size * 240) / 220, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: P.skySoft, borderWidth: 2.5, borderColor: P.ink, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }}
      >
        <WT t="?" size={size * 0.5} font="display" maxW={d} align="center" />
      </View>
    </View>
  );
}

function AgePill({ e, since }: { e: PreviewEntry; since: string | null }) {
  if (e.isSoftStale) return <Pill text={e.ageShort} fill={P.butter} size={11} clock rotation={2} />;
  if (since) return <Pill text={since} fill={P.butterSoft} size={11} rotation={2} />;
  return null;
}

// ---------- stato "dorme" ----------
export function Sleepy({ e, compact, report }: R & { compact: boolean }) {
  const title = e.state === "empty" ? "Ancora niente" : e.state === "unpaired" ? "Manca una persona" : compact ? "Dorme" : "Dorme da un po'";
  const sub = e.state === "hardStale" ? "Apri Fragolina per svegliarla." : "Apri Fragolina per collegarvi.";
  if (compact)
    return (
      <View style={{ flex: 1, gap: 4 }}>
        <StrawberryFace sleeping size={58} />
        <Spacer />
        <WT t={title} size={19} font="display" lines={2} min={0.6} flag={report} />
        <WT t={sub} size={12} font="semi" lines={2} min={0.85} flag={report} />
      </View>
    );
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 16 }}>
      <StrawberryFace sleeping size={92} />
      <View style={{ flex: 1, gap: 4 }}>
        <WT t={title} size={26} font="display" lines={2} min={0.6} flag={report} />
        <WT t={sub} size={14} font="semi" lines={2} min={0.85} flag={report} />
      </View>
    </View>
  );
}

// ---------- umore ----------
export function MoodSmall({ e, report }: R) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box fill={moodFill(e.moodId)} radius={18} offset={3} rotation={-2}>
          <View style={{ padding: 4 }}>
            <MoodOrPlaceholder id={e.moodId} size={38} />
          </View>
        </Box>
        {e.moodId ? <AgePill e={e} since={e.moodSince} /> : null}
      </View>
      <Spacer min={2} />
      <WT t={e.moodId ? e.moodLabel : "Ancora niente"} size={20} font="display" lines={2} min={0.55} tracking={-0.4} flag={report} />
      <WT t={e.partnerShort} size={12} font="heavy" min={0.7} flag={report} />
    </View>
  );
}

export function MoodMedium({ e, report }: R) {
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 12, alignItems: "center" }}>
      <Box fill={moodFill(e.moodId)} radius={22} offset={4} rotation={-1.5} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 8 }}>
          <MoodOrPlaceholder id={e.moodId} size={62} />
          <View style={{ flex: 1, gap: 2 }}>
            <WT t={e.partnerShort} size={12} font="heavy" min={0.7} flag={report} />
            <WT t={e.moodId ? e.moodLabel : "Ancora niente"} size={18} font="display" lines={2} min={0.55} tracking={-0.3} flag={report} />
            {e.isSoftStale ? (
              <WT t={e.updatedText} size={10} min={0.7} flag={report} />
            ) : e.moodId && e.moodSince ? (
              <WT t={e.moodSince} size={11} flag={report} />
            ) : (
              <WT t="Appena sceglie, lo vedi qui." size={10} lines={2} min={0.8} flag={report} />
            )}
          </View>
        </View>
      </Box>
      <Box fill={e.myMoodId ? moodFill(e.myMoodId) : P.skySoft} radius={18} offset={3} rotation={1.5}>
        <View style={{ width: 88, alignItems: "center", paddingVertical: 8, paddingHorizontal: 6, gap: 1 }}>
          <MoodOrPlaceholder id={e.myMoodId} size={38} />
          <WT t={e.meShort} size={11} font="heavy" min={0.6} align="center" flag={report} />
          <WT t={e.myMoodId ? e.myMoodLabel : "Scegli il tuo"} size={10} min={0.6} align="center" flag={report} />
        </View>
      </Box>
    </View>
  );
}

// ---------- penso a te ----------
function PingLines({ e, size = 11, showName = true, report }: R & { size?: number; showName?: boolean }) {
  return (
    <View>
      <WT t={showName ? `pensieri da ${e.partnerShort}` : "pensieri ricevuti"} size={size + 1} font="heavy" min={0.65} flag={report} />
      <WT t={e.isSoftStale ? e.updatedText : (e.lastPingText ?? "Ancora nessuno")} size={size} min={0.7} flag={report} />
    </View>
  );
}

export function PingSmall({ e, report }: R) {
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}>
        <View style={{ flexShrink: 1 }}>
          <WT t={String(e.received)} size={40} font="display" min={0.5} tracking={-1.2} maxW={84} flag={report} />
        </View>
        <HeartGlyph size={15} color={P.strawberry} />
      </View>
      <PingLines e={e} showName={false} report={report} />
      <Spacer min={2} />
      <Pill text="Tocca: penso a te" fill={P.strawberry} size={11} heart rotation={-1} maxW={116} />
    </View>
  );
}

export function PingMedium({ e, report }: R) {
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 14, alignItems: "center" }}>
      <Box fill={P.strawberry} radius={24} offset={4} rotation={-1.5}>
        <View style={{ width: 118, height: 108, padding: 10, alignItems: "center", justifyContent: "center", gap: 4 }}>
          <HeartGlyph size={26} />
          <WT t="Penso a te" size={20} font="display" lines={2} min={0.6} align="center" flag={report} />
          <Pill text="Tocca" fill={P.butter} size={11} maxW={90} />
        </View>
      </Box>
      <View style={{ flex: 1, justifyContent: "center", gap: 2 }}>
        <WT t={String(e.received)} size={50} font="display" min={0.5} tracking={-1.4} flag={report} />
        <PingLines e={e} size={12} report={report} />
        <Spacer min={2} />
        <WT t={e.thoughts === 1 ? "Tu: 1 oggi" : `Tu: ${e.thoughts} oggi`} size={12} font="heavy" min={0.7} flag={report} />
      </View>
    </View>
  );
}

// ---------- giorni ----------
export function DaysSmall({ e, report }: R) {
  const r = e.recurrence;
  return (
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      <View style={{ position: "absolute", right: 0, top: 0 }}>
        <StrawberryFace mood={e.isParty ? "carica" : "innamorata"} size={32} />
      </View>
      {e.daysValue === null ? (
        <>
          <WT t="Da quando?" size={26} font="display" lines={2} min={0.6} flag={report} />
          <WT t="Scegli la data in Fragolina." size={12} lines={2} min={0.8} flag={report} />
        </>
      ) : (
        <>
          <WT t={e.daysText} size={46} font="display" min={0.4} tracking={-1.4} flag={report} />
          <WT t={e.daysCaption} size={13} font="heavy" min={0.7} flag={report} />
          {e.isParty && r ? (
            <View style={{ marginTop: 3 }}>
              <Pill text={`Oggi: ${r.label}!`} fill={P.strawberry} size={11} heart rotation={-1} maxW={116} />
            </View>
          ) : e.nextLine ? (
            <View style={{ marginTop: 1 }}>
              <WT t={e.nextLine} size={11} lines={2} min={0.8} flag={report} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

export function DaysMedium({ e, report }: R) {
  const r = e.recurrence;
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 14, alignItems: "center" }}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        {e.daysValue === null ? (
          <>
            <WT t="Da quando?" size={34} font="display" min={0.6} flag={report} />
            <WT t="Scegli la data in Fragolina." size={13} lines={2} flag={report} />
          </>
        ) : (
          <>
            <WT t={e.daysText} size={54} font="display" min={0.4} tracking={-1.8} flag={report} />
            <WT t={e.daysCaption} size={14} font="heavy" min={0.7} flag={report} />
          </>
        )}
      </View>
      {r ? (
        <Box fill={e.isParty ? P.strawberry : P.butter} radius={22} offset={4} rotation={1.5}>
          <View style={{ width: 122, padding: 10, gap: 3 }}>
            <WT t={e.isParty ? "Auguri a voi" : "Prossima festa"} size={11} font="heavy" min={0.7} flag={report} />
            <WT t={r.label} size={22} font="display" lines={2} min={0.55} tracking={-0.4} flag={report} />
            <WT t={e.isParty ? e.shortDate(r.date) : `${r.daysUntil === 1 ? "domani" : `tra ${r.daysUntil} giorni`} · ${e.shortDate(r.date)}`} size={11} min={0.7} flag={report} />
          </View>
        </Box>
      ) : (
        <StrawberryFace mood="innamorata" size={74} />
      )}
    </View>
  );
}

// ---------- legacy "Fragolina" ----------
export function LegacySmall({ e, report }: R) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box fill={moodFill(e.moodId)} radius={20} offset={3} rotation={-3}>
          <View style={{ padding: 4 }}>
            <MoodOrPlaceholder id={e.moodId} size={34} />
          </View>
        </Box>
        {e.isSoftStale ? (
          <Pill text={e.ageShort} size={12} clock rotation={2} />
        ) : (
          <Box fill={P.strawberry} radius={14} offset={2} rotation={2}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4 }}>
              <HeartGlyph size={10} />
              <WT t={String(e.thoughts)} size={15} font="display" maxW={40} />
            </View>
          </Box>
        )}
      </View>
      <Spacer min={2} />
      <WT t={e.daysText} size={40} font="display" min={0.4} tracking={-1.2} flag={report} />
      <WT t={e.daysValue === null ? "Scegli la data in Fragolina." : "giorni insieme"} size={12} font="heavy" min={0.7} flag={report} />
    </View>
  );
}

export function LegacyMedium({ e, report }: R) {
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 14, alignItems: "center" }}>
      <Box fill={moodFill(e.moodId)} radius={22} offset={4} rotation={-1.5}>
        <View style={{ width: 112, alignItems: "center", paddingVertical: 8, paddingHorizontal: 8, gap: 3 }}>
          <MoodOrPlaceholder id={e.moodId} size={50} />
          <WT t={e.partnerShort} size={12} font="heavy" min={0.7} align="center" flag={report} />
          <WT t={e.moodId ? e.moodLabel : "Ancora niente"} size={11} min={0.6} align="center" flag={report} />
        </View>
      </Box>
      <View style={{ flex: 1, justifyContent: "center", gap: 2 }}>
        <WT t={e.daysText} size={46} font="display" min={0.4} tracking={-1.4} flag={report} />
        <WT t={e.daysValue === null ? "Scegli la data in Fragolina." : "giorni insieme"} size={14} font="heavy" min={0.7} flag={report} />
        <Spacer min={4} />
        <Pill text={e.thoughts === 1 ? "Tu: 1 oggi" : `Tu: ${e.thoughts} oggi`} fill={P.strawberry} size={12} heart rotation={1} maxW={120} />
        <WT t={e.isSoftStale ? e.updatedText : (e.lastPingText ?? "")} size={11} min={0.7} flag={report} />
      </View>
    </View>
  );
}

// ---------- schermata di blocco (monocromatico: bianco su sfondo scuro, come "vibrant") ----------
const W = "#FFFFFF";
const lockBg = "rgba(255,255,255,0.22)";
function LT({ t, size, weight = 600, lines = 1, min = 0.7, maxW, flag }: { t: string; size: number; weight?: number; lines?: number; min?: number; maxW: number; flag?: (m: string) => void }) {
  // stesso sistema di misura ma con il font di sistema
  return <WT t={t} size={size} font={weight >= 800 ? "heavy" : "semi"} lines={lines} min={min} maxW={maxW} color={W} flag={flag} />;
}

export function LockFrame({ w, h, label, round, children }: { w: number; h: number; label: string; round?: boolean; children: React.ReactNode }) {
  return (
    <View testID={`w-${label}`} style={{ width: w, height: h, borderRadius: round ? h / 2 : 12, backgroundColor: lockBg, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

export function LockSleepy({ e, family, report }: R & { family: "circular" | "rectangular" | "inline" }) {
  const stale = e.state === "hardStale";
  const title = stale ? "Dorme da un po'" : "Apri Fragolina";
  const sub = stale ? "Apri Fragolina per svegliarla." : "Apri Fragolina per collegarvi.";
  if (family === "circular") return <LockFrame w={76} h={76} label={`lock-sleepy-${family}`} round><RNText style={{ color: W, fontSize: 22 }}>zZ</RNText></LockFrame>;
  if (family === "inline") return <View testID="w-inline"><LT t={`☾ ${title}`} size={15} weight={600} maxW={257} flag={report} /></View>;
  return (
    <LockFrame w={172} h={76} label="lock-sleepy-rect">
      <View style={{ width: 160 }}>
        <LT t={`☾ ${title}`} size={14} weight={800} maxW={160} flag={report} />
        <LT t={sub} size={12} lines={2} maxW={160} flag={report} />
      </View>
    </LockFrame>
  );
}

export function LockDays({ e, family, report }: R & { family: "circular" | "rectangular" | "inline" }) {
  if (family === "circular")
    return (
      <LockFrame w={76} h={76} label="lockdays-circular" round>
        <View style={{ alignItems: "center", width: 60 }}>
          <HeartGlyph size={10} color={W} />
          <LT t={e.daysText} size={21} weight={800} min={0.45} maxW={60} flag={report} />
          <LT t="giorni" size={9} weight={800} maxW={60} />
        </View>
      </LockFrame>
    );
  if (family === "inline")
    return (
      <View testID="w-lockdays-inline" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <HeartGlyph size={12} color={W} />
        <LT t={e.lockDaysWith} size={15} weight={600} min={0.7} maxW={235} flag={report} />
      </View>
    );
  return (
    <LockFrame w={172} h={76} label="lockdays-rect">
      <View style={{ width: 160 }}>
        <LT t={e.lockDaysWith} size={15} weight={800} min={0.65} maxW={160} flag={report} />
        {e.nextLine ? <LT t={e.nextLine} size={12} min={0.8} maxW={160} flag={report} /> : null}
        <LT t={e.isSoftStale ? e.updatedText : `${e.partnerShort}: ${e.moodId ? e.moodLabel : "Ancora niente"}`} size={12} min={0.8} maxW={160} flag={report} />
      </View>
    </LockFrame>
  );
}

export function LockMood({ e, family, report }: R & { family: "circular" | "rectangular" | "inline" }) {
  const line = `${e.partnerShort}: ${e.moodId ? e.moodLabel : "Ancora niente"}`;
  if (family === "circular")
    return (
      <LockFrame w={76} h={76} label="lockmood-circular" round>
        <View style={{ color: W } as never}><LockMoodGlyph mood={e.moodId} size={44} /></View>
      </LockFrame>
    );
  if (family === "inline")
    return (
      <View testID="w-lockmood-inline" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <HeartGlyph size={12} color={W} />
        <LT t={line} size={15} weight={600} min={0.7} maxW={235} flag={report} />
      </View>
    );
  return (
    <LockFrame w={172} h={76} label="lockmood-rect">
      <View style={{ width: 160, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <LockMoodGlyph mood={e.moodId} size={38} />
        <View style={{ width: 114 }}>
          <LT t={e.partnerShort} size={14} weight={800} maxW={114} flag={report} />
          <LT t={e.moodId ? e.moodLabel : "Ancora niente"} size={13} maxW={114} flag={report} />
          <LT t={e.isSoftStale ? e.updatedText : `♥ ${e.received === 1 ? "1 pensiero" : `${e.received} pensieri`}`} size={11} maxW={114} flag={report} />
        </View>
      </View>
    </LockFrame>
  );
}

export { Confetti, Frame };
