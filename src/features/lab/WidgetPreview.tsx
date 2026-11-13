import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text as RNText, View } from "react-native";

import { fonts, palette as P } from "@/design/tokens";
import { civilFromDays, daysFromCivil } from "@/lib/recurrence";
import { distanceWidgetModel, noteWidgetModel } from "@/lib/note/widgetModel";
import { type WidgetSnapshot, decodeSnapshot } from "@/lib/widgetPayload";

import { PreviewEntry } from "./widgets/model";
import { Confetti, Frame } from "./widgets/kit-exports";
import * as NV from "./widgets/noteViews";
import * as PV from "./widgets/petViews";
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
  v: 5,
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
  petHatched: true,
  petStage: "sprout",
  petName: "Bacca",
  petFood: 640,
  petLove: 820,
  petEnergy: 600,
  petAt: NOW - 30 * MIN,
  petSleepUntil: 0,
  petLastAt: NOW - 30 * MIN,
  petDay: TODAY,
  petBoth: false,
  petLastBy: "partner",
  petLastKind: "feed",
  petLastItem: "mora",
  noteId: "n1",
  noteKind: "draw",
  noteContent: {
    strokes: [
      { c: "strawberry", w: 2, p: [[500, 860], [300, 700], [240, 520], [330, 380], [500, 470], [670, 380], [760, 520], [700, 700], [500, 860]] },
      { c: "leaf", w: 1, p: [[500, 470], [470, 380], [420, 320]] },
    ],
  },
  noteBy: "partner",
  noteByName: "Nikole",
  noteAt: NOW - 12 * MIN,
  noteExpiresAt: NOW + 48 * MIN,
  shareMine: true,
  myLatE2: 4190,
  myLonE2: 1250,
  myLocAt: NOW - 10 * MIN,
  partnerLocState: "ok",
  partnerLatE2: 4546,
  partnerLonE2: 919,
  partnerLocAt: NOW - 25 * MIN,
  feedUrl: "",
  feedKey: "",
  feedToken: "",
};

const squiggle = (k: number) => ({
  c: (["ink", "strawberry", "leaf", "sky", "butter"] as const)[k % 5]!,
  w: (k % 2 === 0 ? 2 : 1) as 1 | 2,
  p: Array.from({ length: 36 }, (_, i) => [Math.round(500 + Math.sin(i / 3 + k) * (120 + k * 9)), Math.round(500 + Math.cos(i / 2.3 + k * 1.7) * (130 + k * 8))] as [number, number]),
});
const note = (over: Partial<WidgetSnapshot>): WidgetSnapshot => ({ ...base, ...over });

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
  { id: "pet-fame", title: "Pet: ha fame (pancia bassa), germoglio", snap: { ...base, petFood: 200, petLove: 700, petEnergy: 700, petAt: NOW } },
  { id: "pet-aspetta", title: "Pet: vi aspetta (coccole basse), fragolina", snap: { ...base, petStage: "berry", petFood: 800, petLove: 150, petEnergy: 700, petAt: NOW } },
  { id: "pet-sonno", title: "Pet: ha sonno (energia bassa), semino", snap: { ...base, petStage: "seed", petFood: 800, petLove: 700, petEnergy: 100, petAt: NOW } },
  { id: "pet-nanna", title: "Pet: fa la nanna (luce spenta), fragolona", snap: { ...base, petStage: "big", petSleepUntil: NOW + 80 * MIN, petAt: NOW } },
  { id: "pet-amore", title: "Pet: 'vi vuole bene' (curato in due oggi), fragolona", snap: { ...base, petStage: "big", petBoth: true, petFood: 900, petLove: 900, petEnergy: 900, petAt: NOW } },
  { id: "pet-abbandono", title: "Pet: nessuna cura da 5 giorni, torna a dormire", snap: { ...base, petLastAt: NOW - 5 * 86400_000, petAt: NOW - 5 * 86400_000, petLastBy: "me", petLastKind: "cuddle", petLastItem: "", updatedAt: NOW - 20 * MIN } },
  { id: "pet-uovo", title: "Pet: l'uovo", snap: { ...base, petHatched: false, petStage: "egg", petName: "", petLastAt: null, petLastBy: "", petLastKind: "", petLastItem: "", petAt: null } },
  { id: "pet-nome16", title: "Pet: nome di 16 caratteri, ultima cura mia", snap: { ...base, petName: "Fragolotta Reale", partnerName: "Maria Antonietta", petLastBy: "partner", petLastKind: "play", petLastItem: "" } },
  { id: "nota-scritta80", title: "Biglietto: scritta di 80 caratteri su fondo fragola", snap: note({ noteKind: "text", noteContent: { text: "Ti aspetto stasera sul divano con la pizza, i biscotti e quella serie che dicevi tu ok?", bg: "strawberry" }, noteId: "n2" }) },
  { id: "nota-accenti", title: "Biglietto: accenti ed emoji, nome lungo", snap: note({ noteKind: "text", noteContent: { text: "È già tardi? Zoë ti vuole bene 🍓", bg: "blush" }, noteId: "n3", noteByName: "Maria Antonietta", partnerName: "Maria Antonietta" }) },
  { id: "nota-tratti", title: "Biglietto: disegno con 40 tratti", snap: note({ noteId: "n4", noteContent: { strokes: Array.from({ length: 40 }, (_, k) => squiggle(k)) } }) },
  { id: "nota-puntino", title: "Biglietto: un solo puntino", snap: note({ noteId: "n5", noteContent: { strokes: [{ c: "strawberry", w: 2, p: [[500, 500], [500, 500]] }] } }) },
  { id: "nota-mia", title: "Biglietto: l'ho mandato io (da solo: 'da te')", snap: note({ noteBy: "me", noteByName: "Leonardo", paired: false, partnerLocState: "" }) },
  { id: "nota-scade", title: "Biglietto: sparisce tra meno di un minuto", snap: note({ noteExpiresAt: NOW + 30_000 }) },
  { id: "nota-scaduto", title: "Biglietto: scaduto (stato gentile)", snap: note({ noteExpiresAt: NOW - 1000 }) },
  { id: "nota-vuoto", title: "Biglietto: nessuno (o pulito)", snap: note({ noteId: "", noteKind: "", noteContent: null, noteBy: "", noteByName: "", noteAt: null, noteExpiresAt: null }) },
  { id: "dist-0", title: "Distanza: vicinissimi (0 km)", snap: note({ partnerLatE2: 4190, partnerLonE2: 1250 }) },
  { id: "dist-19000", title: "Distanza: 19.000 km (agli antipodi)", snap: note({ partnerLatE2: -4190, partnerLonE2: -16750 }) },
  { id: "dist-vecchia", title: "Distanza: posizione di lei vecchia di 5 h", snap: note({ partnerLocAt: NOW - 5 * H }) },
  { id: "dist-nascosta", title: "Distanza: lei l'ha nascosta", snap: note({ partnerLocState: "hidden", partnerLatE2: null, partnerLonE2: null, partnerLocAt: null }) },
  { id: "dist-miaspenta", title: "Distanza: la mia condivisione è spenta", snap: note({ shareMine: false, myLatE2: null, myLonE2: null, myLocAt: null, partnerLocState: "mine_off", partnerLatE2: null, partnerLonE2: null, partnerLocAt: null }) },
  { id: "dist-nonancora", title: "Distanza: lei non l'ha ancora condivisa (nome lungo)", snap: note({ partnerLocState: "none", partnerLatE2: null, partnerLonE2: null, partnerLocAt: null, partnerName: "Maria Antonietta" }) },
  { id: "dist-solo", title: "Distanza: nessuno collegato", snap: note({ paired: false, partnerLocState: "", partnerLatE2: null, partnerLonE2: null, partnerLocAt: null }) },
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
  const raw = c.snap ?? (decodeSnapshot("{}") as WidgetSnapshot);
  const noteM = noteWidgetModel(raw, null, NOW);
  const distM = distanceWidgetModel(raw, null, NOW);
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
      <Row>
        {sm("Pet · piccolo", <PV.PetSmall e={e} report={r} />)}
        {md("Pet · medio", <PV.PetMedium e={e} report={r} />)}
      </Row>
      <Row>
        {sm("Biglietto · piccolo", <NV.NoteSmall m={noteM} report={r} />)}
        {md("Biglietto · medio", <NV.NoteMedium m={noteM} report={r} />)}
      </Row>
      <Row>
        {sm("Distanza · piccolo", <NV.DistSmall d={distM} name={e.partner} report={r} />)}
        {md("Distanza · medio", <NV.DistMedium d={distM} name={e.partner} report={r} />)}
      </Row>
      <View style={{ backgroundColor: "#3a3340", borderRadius: 14, padding: 14, gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          <NV.NoteLock m={noteM} report={r} />
          <NV.DistCircular d={distM} />
          <NV.DistInline d={distM} name={e.partner} report={r} />
        </View>
        {!sleepy ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
            <PV.PetLock e={e} report={r} />
          </View>
        ) : null}
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
