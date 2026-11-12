import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text as RNText, View } from "react-native";

import { fonts, palette as P } from "@/design/tokens";
import { civilFromDays, daysFromCivil } from "@/lib/recurrence";
import type { WidgetSnapshot } from "@/lib/widgetPayload";

import { PreviewEntry } from "./widgets/model";
import { Confetti, Frame } from "./widgets/kit-exports";
import * as V from "./widgets/views";

/**
 * Anteprima web di TUTTI i widget (rotta nascosta /widget-preview): replica in React dei widget SwiftUI, con dati
 * finti e casi peggiori. Serve a rivedere layout e testi senza un Mac. Non è il widget vero: stesse misure
 * (iPhone X, iOS 16, 16 pt di margine), stessi testi, stessi stati. Un riquadro con contenuto troppo grande o un
 * testo troncato viene segnalato in alto e in `window.__widgetFlags`.
 */
const NOW = Date.UTC(2026, 10, 12, 11, 0, 0); // 12/11/2026 12:00 (Roma)
const TODAY = "2026-11-12";
const H = 3600_000;
const MIN = 60_000;

const iso = (days: number) => {
  const [y, m, d] = civilFromDays(daysFromCivil(2026, 11, 12) + days);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

const base: WidgetSnapshot = {
  v: 3,
  updatedAt: NOW - 5 * MIN,
  paired: true,
  partnerName: "Nikole",
  moodId: "innamorata",
  moodLabel: "Innamorata",
  moodAt: NOW - 2 * H,
  thinkingToday: 3,
  pingsReceived: 41,
  lastPingAt: NOW - 10 * MIN,
  startDate: "2025-02-14",
  myName: "Leonardo",
  myMoodId: "carica",
  myMoodLabel: "Carica",
  myMoodAt: NOW - 5 * H,
  questionText: "Cena di sabato: cosa vince?",
  questionMineDone: true,
  questionBothDone: false,
};

type Case = { id: string; title: string; snap: WidgetSnapshot | null };
const CASES: Case[] = [
  { id: "normale", title: "Normale", snap: base },
  {
    id: "peggiore",
    title: "Caso peggiore: Maria Antonietta, 10000 giorni, 999 pensieri, umore lungo",
    snap: {
      ...base,
      partnerName: "Maria Antonietta",
      myName: "Massimiliano Alessandro",
      moodId: "coccole",
      moodLabel: "Voglia di coccole",
      myMoodId: "coccole",
      myMoodLabel: "Voglia di coccole",
      startDate: iso(-10000),
      pingsReceived: 999,
      thinkingToday: 128,
      lastPingAt: NOW - 3 * 86400_000,
    },
  },
  {
    id: "nome24",
    title: "Nome di 24 caratteri, 9999 giorni",
    snap: { ...base, partnerName: "Maria-Chiara Anna Rossi!", myName: "Gianfrancesco Maria Luigi", startDate: iso(-9999), moodId: "stressata", moodLabel: "Stressata" },
  },
  { id: "festa-mesi", title: "Giorno di festa: 6 mesi", snap: { ...base, startDate: "2026-05-12" } },
  { id: "festa-100", title: "Giorno di festa: 100 giorni", snap: { ...base, startDate: iso(-100) } },
  { id: "tra-12", title: "Tra 12 giorni: 6 mesi", snap: { ...base, startDate: "2026-05-24" } },
  { id: "un-giorno", title: "1 giorno insieme", snap: { ...base, startDate: iso(-1) } },
  { id: "senza-data", title: "Data non scelta", snap: { ...base, startDate: null } },
  { id: "senza-umore", title: "Nessun umore (né suo né mio), nessun pensiero", snap: { ...base, moodId: null, moodLabel: "", moodAt: null, myMoodId: null, myMoodLabel: "", myMoodAt: null, pingsReceived: 0, lastPingAt: null, thinkingToday: 0 } },
  { id: "dati-vecchi", title: "Dati vecchi (> 3 h): 'aggiornato X fa'", snap: { ...base, updatedAt: NOW - 5 * H } },
  { id: "dorme", title: "Fermo da > 48 h: la fragola dorme", snap: { ...base, updatedAt: NOW - 50 * H } },
  { id: "non-collegati", title: "Non collegati", snap: { ...base, paired: false, partnerName: "Nikole" } },
  { id: "vuoto", title: "Vuoto (l'app non ha ancora scritto)", snap: null },
];
const STATE_ONLY = new Set(["dorme", "non-collegati", "vuoto"]);

function Label({ children }: { children: string }) {
  return <RNText style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: "#5b4b57", marginBottom: 6 }}>{children}</RNText>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginBottom: 14 }}>{children}</View>;
}

function Wrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Label>{label}</Label>
      {children}
    </View>
  );
}

function CaseView({ c, report }: { c: Case; report: (m: string) => void }) {
  const e = useMemo(() => new PreviewEntry(c.snap, NOW, TODAY), [c.snap]);
  const r = useCallback((m: string) => report(`[${c.id}] ${m}`), [report, c.id]);
  const sleepy = e.state !== "ok";
  const sm = (label: string, body: React.ReactNode, confetti = false) => (
    <Wrap label={label}>
      <Frame label={`${c.id}-${label}`} report={r} confetti={confetti ? <Confetti w={148} h={148} /> : undefined}>
        {sleepy ? <V.Sleepy e={e} compact report={r} /> : body}
      </Frame>
    </Wrap>
  );
  const md = (label: string, body: React.ReactNode, confetti = false) => (
    <Wrap label={label}>
      <Frame w={321} label={`${c.id}-${label}`} report={r} confetti={confetti ? <Confetti w={321} h={148} /> : undefined}>
        {sleepy ? <V.Sleepy e={e} compact={false} report={r} /> : body}
      </Frame>
    </Wrap>
  );
  const party = e.isParty && !sleepy;
  return (
    <View testID={`case-${c.id}`} style={{ padding: 16, backgroundColor: "#EFE7EA", borderRadius: 16, marginBottom: 18 }}>
      <RNText style={{ fontFamily: fonts.display, fontSize: 20, color: P.ink, marginBottom: 12 }}>{c.title}</RNText>
      <Row>
        {sm("Umore · piccolo", <V.MoodSmall e={e} report={r} />)}
        {md("Umore · medio", <V.MoodMedium e={e} report={r} />)}
      </Row>
      <Row>
        {sm("Penso a te · piccolo", <V.PingSmall e={e} report={r} />)}
        {md("Penso a te · medio", <V.PingMedium e={e} report={r} />)}
      </Row>
      <Row>
        {sm("Giorni · piccolo", <V.DaysSmall e={e} report={r} />, party)}
        {md("Giorni · medio", <V.DaysMedium e={e} report={r} />, party)}
      </Row>
      {!STATE_ONLY.has(c.id) ? (
        <Row>
          {sm("Fragolina · piccolo", <V.LegacySmall e={e} report={r} />)}
          {md("Fragolina · medio", <V.LegacyMedium e={e} report={r} />)}
        </Row>
      ) : null}
      <View style={{ backgroundColor: "#3a3340", borderRadius: 14, padding: 14, gap: 12 }}>
        <RNText style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: "#d8cfd6" }}>Schermata di blocco (monocromatico)</RNText>
        {(["Noi", "Umore"] as const).map((k) => (
          <View key={k} style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
            {(["circular", "rectangular", "inline"] as const).map((fam) =>
              sleepy ? (
                <V.LockSleepy key={fam} e={e} family={fam} report={r} />
              ) : k === "Noi" ? (
                <V.LockDays key={fam} e={e} family={fam} report={r} />
              ) : (
                <V.LockMood key={fam} e={e} family={fam} report={r} />
              ),
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

export function WidgetPreview() {
  const [flags, setFlags] = useState<string[]>([]);
  const seen = useRef(new Set<string>());
  const report = useCallback((m: string) => {
    if (seen.current.has(m)) return;
    seen.current.add(m);
    setFlags((f) => [...f, m]);
  }, []);
  useEffect(() => {
    (globalThis as { __widgetFlags?: string[] }).__widgetFlags = flags;
  }, [flags]);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#DDD3D8" }} contentContainerStyle={{ padding: 16 }}>
      <RNText style={{ fontFamily: fonts.display, fontSize: 28, color: P.ink }}>Anteprima widget</RNText>
      <RNText testID="flags" style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: flags.length ? "#C4143A" : "#2b7a4b", marginVertical: 8 }}>
        {flags.length ? `${flags.length} segnalazioni:\n${flags.join("\n")}` : "Nessuna segnalazione (nessun testo troncato, nessun riquadro troppo pieno)."}
      </RNText>
      {CASES.map((c) => (
        <CaseView key={c.id} c={c} report={report} />
      ))}
    </ScrollView>
  );
}
