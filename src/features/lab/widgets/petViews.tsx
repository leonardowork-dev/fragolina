import React from "react";
import { View } from "react-native";

import { PetArt } from "@/design/mascot/PetArt";
import { palette as P } from "@/design/tokens";
import { type PetWidgetModel, petWidgetModel } from "@/lib/pet/widgetModel";
import type { PetFace } from "@/design/mascot/PetArt";

import { Box, Pill, WT } from "./kit";
import type { PreviewEntry } from "./model";
import { LockFrame } from "./views";

/**
 * Anteprima del widget del pet (targets/widget/PetWidget.swift): piccolo, medio e blocco (rettangolare). Usa lo
 * stesso modello (`petWidgetModel`) che la prova Swift↔TypeScript confronta con il codice Swift vero.
 */
type R = { e: PreviewEntry; report?: (m: string) => void };
const Spacer = ({ min = 0 }: { min?: number }) => <View style={{ flexGrow: 1, minHeight: min }} />;

export const modelOf = (e: PreviewEntry): PetWidgetModel => petWidgetModel(e.snap!, e.nowMs, e.todayIso);
const faceOf = (m: PetWidgetModel): PetFace => (m.mood === "away" || m.mood === "egg" ? "asleep" : (m.mood as PetFace));
const stageOf = (m: PetWidgetModel) => (m.stage === "seed" || m.stage === "sprout" || m.stage === "berry" || m.stage === "big" || m.stage === "egg" ? m.stage : "egg");
const title = (m: PetWidgetModel) => (m.hatched ? m.name : "L'uovo");

function Dot({ full, soft, level, size = 14 }: { full: string; soft: string; level: number; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: level >= 3 ? full : level === 2 ? soft : P.strawberry,
        borderWidth: 2,
        borderColor: P.ink,
      }}
    />
  );
}

function Chip({ label, fill, level }: { label: string; fill: string; level: number }) {
  return (
    <View style={{ flex: 1 }}>
      <Box fill={fill} radius={12} offset={2}>
        <View style={{ alignItems: "center", gap: 2, paddingVertical: 4, paddingHorizontal: 6 }}>
          <WT t={label} size={10} font="heavy" min={0.7} maxW={40} />
          <View style={{ flexDirection: "row", gap: 3 }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: P.ink,
                  backgroundColor: i < level ? (level === 1 ? P.strawberry : P.ink) : P.paper,
                }}
              />
            ))}
          </View>
        </View>
      </Box>
    </View>
  );
}

export function PetSmall({ e, report }: R) {
  const m = modelOf(e);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <PetArt stage={stageOf(m)} face={faceOf(m)} size={60} />
        <View style={{ alignItems: "flex-end", gap: 5 }}>
          {e.isSoftStale ? <Pill text={e.ageShort} fill={P.butter} size={11} clock rotation={2} /> : null}
          {m.hatched ? (
            <View style={{ gap: 4 }}>
              <Dot full={P.butter} soft={P.butterSoft} level={m.dots.food} />
              <Dot full={P.blush} soft={P.blushSoft} level={m.dots.love} />
              <Dot full={P.sky} soft={P.skySoft} level={m.dots.energy} />
            </View>
          ) : null}
        </View>
      </View>
      <Spacer min={2} />
      <WT t={title(m)} size={19} font="display" min={0.55} tracking={-0.4} flag={report} />
      <WT t={m.say} size={12} font="heavy" min={0.7} flag={report} />
    </View>
  );
}

export function PetMedium({ e, report }: R) {
  const m = modelOf(e);
  const night = m.mood === "asleep" || m.mood === "away";
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Box fill={night ? P.ink : P.skySoft} radius={22} offset={4} rotation={-1.5}>
        <View style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
          <PetArt stage={stageOf(m)} face={faceOf(m)} size={66} />
        </View>
      </Box>
      <View style={{ flex: 1, gap: 3 }}>
        <WT t={title(m)} size={24} font="display" min={0.5} tracking={-0.4} flag={report} />
        <WT t={m.say} size={13} font="heavy" min={0.7} flag={report} />
        {m.hatched ? (
          <View style={{ flexDirection: "row", gap: 4, paddingRight: 3 }}>
            <Chip label="Pancia" fill={P.butter} level={m.dots.food} />
            <Chip label="Coccole" fill={P.blush} level={m.dots.love} />
            <Chip label="Sonno" fill={P.sky} level={m.dots.energy} />
          </View>
        ) : null}
        {e.isSoftStale ? (
          <WT t={e.updatedText} size={10} font="semi" min={0.7} flag={report} />
        ) : m.lastLine ? (
          <WT t={m.lastLine} size={10} font="semi" min={0.65} flag={report} />
        ) : null}
      </View>
    </View>
  );
}

const W = "#FFFFFF";
export function PetLock({ e, report }: R) {
  const m = modelOf(e);
  const op = (n: number) => (n >= 3 ? 1 : n === 2 ? 0.6 : 0.3);
  return (
    <LockFrame w={172} h={76} label="petlock-rect">
      <View style={{ width: 160, gap: 2 }}>
        <WT t={title(m)} size={14} font="heavy" min={0.7} maxW={160} color={W} flag={report} />
        <WT t={m.say} size={12} font="semi" min={0.7} maxW={160} color={W} flag={report} />
        {m.hatched ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["food", "love", "energy"] as const).map((k) => (
              <View key={k} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: W, opacity: op(m.dots[k]) }} />
            ))}
          </View>
        ) : null}
      </View>
    </LockFrame>
  );
}
