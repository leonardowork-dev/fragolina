import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { civilFromDays, daysFromCivil, daysInMonthYmd, daysTogether, nextRecurrence } from "@/lib/recurrence";
import { timeAgo } from "@/lib/time";
import { decay } from "@/lib/pet/rules";
import { distanceView, haversineKm } from "@/lib/geo/distance";
import { distanceTimelineMs, distanceWidgetModel, feedFromJson, noteTimelineMs, noteWidgetModel } from "@/lib/note/widgetModel";
import { petTimelineMs, petWidgetModel } from "@/lib/pet/widgetModel";
import { type WidgetSnapshot, decodeSnapshot } from "@/lib/widgetPayload";

/**
 * Prova opzionale: compila il codice Swift PURO del widget (targets/widget/Model.swift + Strings.swift) con un
 * compilatore Swift su Linux/Mac e lo confronta con TypeScript sulle stesse fixture e su migliaia di casi casuali.
 * Si attiva con `SWIFTC=/percorso/swiftc npm run swift:check` (senza SWIFTC resta "saltata").
 * Su WSL senza sudo servono sysroot e librerie estratte a mano: vedi KNOWN_ISSUES.md ("Prova Swift su Linux").
 */
const root = path.resolve(__dirname, "..");
const swiftc = process.env.SWIFTC;
const available = !!swiftc && spawnSync(swiftc, ["--version"]).status === 0;

function utcMidnightAfter(ms: number) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 10);
}

let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const iso = ([y, m, d]: [number, number, number]) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
const randDay = (from: [number, number, number], to: [number, number, number]) => {
  const a = daysFromCivil(...from);
  return civilFromDays(Math.floor(a + rnd() * (daysFromCivil(...to) - a)));
};

describe.skipIf(!available)("Swift ↔ TypeScript (compilatore Swift reale)", () => {
  let tmp = "";
  let out: any;
  const recCases: { start: string | null; today: string }[] = JSON.parse(
    fs.readFileSync(path.join(root, "tests/fixtures/recurrence-cases.json"), "utf8"),
  ).map((c: any) => ({ start: c.start, today: c.today }));
  const ago = [0, 1, 44, 45, 59, 60, 89, 90, 3599, 3600, 5399, 5400, 7200, 86399, 86400, 129599, 129600, 172800, 518400];
  const fx = (n: string) => fs.readFileSync(path.join(root, "tests/fixtures", n), "utf8");
  const snapshots: Record<string, string> = {
    v5: fx("widget-snapshot.json"),
    v4: fx("widget-snapshot-v4.json"),
    v3: fx("widget-snapshot-v3.json"),
    v2: fx("widget-snapshot-v2.json"),
    v1: fx("widget-snapshot-v1.json"),
    futuro: '{"v":9,"updatedAt":5,"partnerName":"N","nuovo":{"a":[1,2]},"questionMineDone":true}',
    tipiSbagliati: '{"v":"x","updatedAt":"ieri","paired":"si","partnerName":3,"thinkingToday":"tre","myMoodAt":"mai","questionMineDone":"sì"}',
    vuoto: "{}",
    accenti: JSON.stringify({ v: 3, partnerName: "Zoë Àngela 🍓", questionText: "È già tardi?" }),
  };
  const nowMs = Date.UTC(2026, 10, 12, 20, 15, 0);

  // ---- pet: stati e orari casuali (il widget ricalcola da solo, quindi Swift e TypeScript devono coincidere) ----
  const H = 3_600_000;
  const KINDS = ["", "feed", "cuddle", "play", "sleep", "hatch", "boh"];
  const ITEMS = ["", "mora", "lampone", "mirtillo", "pesca", "pizza"];
  const NAMES = ["", "Bacca", "Fragolotta Reale", "Zoë", "Ça va bene"];
  const randSnap = (): WidgetSnapshot => {
    const at = nowMs - Math.floor(rnd() * 30 * H);
    const hatched = rnd() < 0.85;
    const day = (n: number) => iso(randDay([2026, 11, Math.max(1, 12 - n)], [2026, 11, 13]));
    const kind = KINDS[Math.floor(rnd() * KINDS.length)]!;
    return {
      ...(decodeSnapshot("{}") as WidgetSnapshot),
      v: 4,
      paired: true,
      partnerName: rnd() < 0.2 ? "" : "Nikole",
      updatedAt: nowMs - Math.floor(rnd() * 5 * H),
      petHatched: hatched,
      petStage: ["egg", "seed", "sprout", "berry", "big", ""][Math.floor(rnd() * 6)]!,
      petName: NAMES[Math.floor(rnd() * NAMES.length)]!,
      petFood: Math.floor(rnd() * 1001),
      petLove: Math.floor(rnd() * 1001),
      petEnergy: Math.floor(rnd() * 1001),
      petAt: at,
      petSleepUntil: rnd() < 0.2 ? nowMs + Math.floor((rnd() - 0.6) * 4 * H) : 0,
      petLastAt: rnd() < 0.9 ? nowMs - Math.floor(rnd() * 120 * H) : null,
      petDay: rnd() < 0.8 ? day(Math.floor(rnd() * 2)) : "",
      petBoth: rnd() < 0.5,
      petLastBy: ["", "me", "partner"][Math.floor(rnd() * 3)]!,
      petLastKind: kind,
      petLastItem: ITEMS[Math.floor(rnd() * ITEMS.length)]!,
    };
  };
  const petCases: { snap: WidgetSnapshot; nowMs: number; today: string }[] = [];
  const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  for (let i = 0; i < 3000; i++) {
    const t = nowMs + Math.floor((rnd() - 0.2) * 60 * H); // il momento della voce della timeline
    petCases.push({ snap: randSnap(), nowMs: t, today: utcDay(t) });
  }
  // casi di confine esatti: soglie 350/650, tre giorni, fine nanna
  const edge = (over: Partial<WidgetSnapshot>, dt = 0): void => {
    petCases.push({ snap: { ...randSnap(), petHatched: true, petAt: nowMs, petSleepUntil: 0, petLastAt: nowMs, petBoth: false, ...over }, nowMs: nowMs + dt, today: utcDay(nowMs + dt) });
  };
  for (const v of [349, 350, 351]) edge({ petFood: v, petLove: 900, petEnergy: 900 });
  for (const v of [649, 650, 651]) edge({ petFood: v, petLove: v, petEnergy: v });
  edge({}, 72 * H);
  edge({}, 72 * H + 1);
  edge({ petSleepUntil: nowMs + 1000 }, 999);
  edge({ petSleepUntil: nowMs + 1000 }, 1000);
  const decayCases: number[][] = [];
  for (let i = 0; i < 4000; i++) decayCases.push([Math.floor(rnd() * 1001), [45, 30, 20][i % 3]!, Math.floor((rnd() - 0.1) * 400 * H)]);
  const petTlCases = petCases.slice(0, 400).map((c) => ({ ...c, midnights: [utcMidnightAfter(c.nowMs), utcMidnightAfter(c.nowMs) + 86400_000] }));


  // ---- biglietto e distanza (sessione 5): snapshot + feed + orario della voce, tutto casuale ----
  const INKS = ["ink", "strawberry", "leaf", "sky", "butter"];
  const BGS = ["butter", "blush", "sky", "leaf", "strawberry", "paper"];
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
  const randContent = () =>
    rnd() < 0.5
      ? { text: pick(["Ti penso", "Cena alle 8?", "Zoë 🍓 ti vuole bene — àèìòù", "x".repeat(80)]), bg: pick(BGS) }
      : { strokes: Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({ c: pick(INKS), w: 1 + Math.floor(rnd() * 2), p: Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => [Math.floor(rnd() * 1001), Math.floor(rnd() * 1001)]) })) };
  const randLat = () => Math.floor((rnd() - 0.5) * 17000);
  const randLon = () => Math.floor((rnd() - 0.5) * 35000);
  const randBoardSnap = (t: number): WidgetSnapshot => {
    const hasNote = rnd() < 0.7;
    const at = t - Math.floor(rnd() * 80 * 60_000);
    return {
      ...(decodeSnapshot("{}") as WidgetSnapshot),
      v: 5,
      paired: rnd() < 0.85,
      partnerName: rnd() < 0.2 ? "" : pick(["Nikole", "Zoë Àngela", "Maria Chiara Elisabetta"]),
      noteId: hasNote ? "id-" + Math.floor(rnd() * 1e6) : "",
      noteKind: hasNote ? pick(["draw", "text", "boh"]) : "",
      noteContent: hasNote ? (randContent() as never) : null,
      noteBy: hasNote ? pick(["me", "partner", ""]) : "",
      noteByName: hasNote ? pick(["", "Nikole", "Leonardo"]) : "",
      noteAt: hasNote ? at : null,
      noteExpiresAt: hasNote ? at + 3_600_000 : null,
      shareMine: rnd() < 0.8,
      myLatE2: rnd() < 0.9 ? randLat() : null,
      myLonE2: rnd() < 0.9 ? randLon() : null,
      myLocAt: t - 1000,
      partnerLocState: pick(["", "ok", "ok", "hidden", "mine_off", "none", "boh"]),
      partnerLatE2: rnd() < 0.9 ? randLat() : null,
      partnerLonE2: rnd() < 0.9 ? randLon() : null,
      partnerLocAt: rnd() < 0.9 ? t - Math.floor(rnd() * 8 * H) : null,
    };
  };
  const randFeedRaw = (t: number): string | null => {
    const r = rnd();
    if (r < 0.35) return null;
    const at = t - Math.floor(rnd() * 80 * 60_000);
    return JSON.stringify({
      ok: true,
      now: t,
      note: rnd() < 0.7 ? { id: "feed-" + Math.floor(rnd() * 1e6), kind: pick(["draw", "text"]), content: randContent(), by: pick(["me", "partner"]), byName: pick(["", "Nikole"]), createdAt: at, expiresAt: at + 3_600_000, clearedAt: null } : null,
      partner: rnd() < 0.8 ? { name: "Nikole", state: pick(["ok", "ok", "hidden", "mine_off", "none"]), latE2: randLat(), lonE2: randLon(), at: t - Math.floor(rnd() * 8 * H) } : null,
    });
  };
  const boardCases: { snap: WidgetSnapshot; feed: string | null; revoked: boolean; nowMs: number }[] = [];
  for (let i = 0; i < 2500; i++) {
    const t = nowMs + Math.floor((rnd() - 0.2) * 5 * H);
    boardCases.push({ snap: randBoardSnap(t), feed: randFeedRaw(t), revoked: rnd() < 0.05, nowMs: t });
  }
  // confini: scadenza esatta, 1 ms prima, 1 min prima
  for (const dt of [-1, 0, 1, 59_999, 60_000, 60_001]) {
    const s = randBoardSnap(nowMs);
    boardCases.push({ snap: { ...s, noteId: "edge", noteContent: { text: "x", bg: "sky" } as never, noteKind: "text", noteAt: nowMs, noteExpiresAt: nowMs + 3_600_000 }, feed: null, revoked: false, nowMs: nowMs + 3_600_000 + dt });
  }
  const geoCases: number[][] = [[4190, 1250, 4190, 1250], [4190, 1250, 4191, 1250], [4190, 1250, 4193, 1250], [4190, 1250, 4546, 919], [4190, 1250, 4040, -7400], [0, 0, 0, 18000], [9000, 0, -9000, 0], [-3386, 15121, 5151, -13]];
  for (let i = 0; i < 3000; i++) geoCases.push([randLat(), randLon(), randLat(), randLon()]);
  const noteTlCases = Array.from({ length: 200 }, () => {
    const t = nowMs + Math.floor(rnd() * 3 * H);
    return { nowMs: t, expiresAtMs: rnd() < 0.2 ? null : t + Math.floor((rnd() - 0.1) * 2 * H) };
  });
  const distTlCases = Array.from({ length: 200 }, () => {
    const t = nowMs + Math.floor(rnd() * 3 * H);
    return { nowMs: t, partnerAtMs: rnd() < 0.2 ? null : t - Math.floor(rnd() * 6 * H) };
  });

  beforeAll(() => {
    for (let i = 0; i < 4000; i++) {
      const s = randDay([1995, 1, 1], [2026, 11, 30]);
      recCases.push({ start: iso(s), today: iso(randDay(s, [2060, 12, 31])) });
    }
    for (let i = 0; i < 600; i++) {
      // fine mese e bisestili: giorni 28-31 e il 29 febbraio
      const y = 2000 + Math.floor(rnd() * 30);
      const m = 1 + Math.floor(rnd() * 12);
      const d = Math.min(daysInMonthYmd(y, m), 28 + Math.floor(rnd() * 4));
      recCases.push({ start: iso([y, m, d]), today: iso(randDay([y, m, d], [y + 6, 12, 31])) });
    }
    for (let i = 0; i < 500; i++) ago.push(Math.floor(rnd() * 20 * 86400));
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fragolina-swift-"));
    const bin = path.join(tmp, "check");
    execFileSync(
      swiftc!,
      [
        path.join(root, "targets/widget/Model.swift"),
        path.join(root, "targets/widget/Strings.swift"),
        path.join(root, "tests/swift/main.swift"),
        "-o",
        bin,
      ],
      { stdio: "inherit" },
    );
    fs.writeFileSync(
      path.join(tmp, "in.json"),
      JSON.stringify({
        recurrence: recCases,
        days: recCases,
        ago,
        snapshots,
        timeline: { nowMs, updatedAtMs: nowMs - 3600_000 },
        pet: petCases.map((c) => ({ snapshot: JSON.stringify(c.snap), nowMs: c.nowMs })),
        petTimeline: petTlCases.map((c) => ({ snapshot: JSON.stringify(c.snap), nowMs: c.nowMs, midnightsMs: c.midnights })),
        decay: decayCases,
        note: boardCases.map((c) => ({ snapshot: JSON.stringify(c.snap), feed: c.feed, revoked: c.revoked, nowMs: c.nowMs })),
        distance: boardCases.map((c) => ({ snapshot: JSON.stringify(c.snap), feed: c.feed, revoked: c.revoked, nowMs: c.nowMs })),
        geo: geoCases,
        noteTimeline: noteTlCases,
        distanceTimeline: distTlCases,
      }),
    );
    // TZ=UTC: il "giorno di oggi" del widget (calendario locale) e quello di TypeScript sono lo stesso
    execFileSync(bin, [path.join(tmp, "in.json"), path.join(tmp, "out.json")], { stdio: "inherit", env: { ...process.env, TZ: "UTC" } });
    out = JSON.parse(fs.readFileSync(path.join(tmp, "out.json"), "utf8"));
  }, 240_000);
  afterAll(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("ricorrenze: stesso risultato su tabella di verità + migliaia di casi casuali", () => {
    const diffs: string[] = [];
    recCases.forEach((c, i) => {
      const ts = nextRecurrence(c.start, c.today);
      const a = ts ? { count: ts.count, date: ts.date, daysUntil: ts.daysUntil, kind: ts.kind, label: ts.label } : null;
      if (JSON.stringify(a) !== JSON.stringify(out.recurrence[i]))
        diffs.push(`${JSON.stringify(c)} TS=${JSON.stringify(a)} Swift=${JSON.stringify(out.recurrence[i])}`);
    });
    expect(diffs.slice(0, 5)).toEqual([]);
    expect(recCases.length).toBeGreaterThan(4000);
  });
  it("giorni insieme: stesso numero", () => {
    const diffs = recCases.flatMap((c, i) =>
      daysTogether(c.start, c.today) === out.days[i] ? [] : [`${JSON.stringify(c)} Swift=${out.days[i]}`],
    );
    expect(diffs.slice(0, 5)).toEqual([]);
  });
  it('"X fa": stesse parole e stesse soglie', () => {
    const diffs = ago.flatMap((s, i) => {
      const ts = timeAgo(0, s * 1000);
      return ts === out.ago[i].ago ? [] : [`${s}s TS="${ts}" Swift="${out.ago[i].ago}"`];
    });
    expect(diffs.slice(0, 5)).toEqual([]);
  });
  it("snapshot: Swift legge v1, v2, v3, futuro e tipi sbagliati come TypeScript", () => {
    for (const [name, raw] of Object.entries(snapshots)) {
      const sw = out.snapshots[name];
      const ts = decodeSnapshot(raw) as Record<string, unknown>;
      expect(sw, `${name} non letto da Swift`).not.toBeNull();
      for (const [k, v] of Object.entries(sw)) expect(ts[k], `${name}.${k}`).toEqual(v);
    }
    // i campi che Swift legge come nil sono vuoti anche in TS
    expect(out.snapshots.tipiSbagliati.thinkingToday).toBeUndefined();
    expect(out.snapshots.v1.myName).toBeUndefined();
    expect(out.snapshots.v3.questionBothDone).toBe(false);
  });
  it("timeline: ordinata, parte da adesso, ha le soglie 3 h e 48 h e arriva a 12 h", () => {
    const tl = out.timeline;
    expect(tl.sorted).toBe(true);
    expect(tl.offsets[0]).toBe(0);
    for (const o of [2 * 3600 + 1, 47 * 3600 + 1]) expect(tl.offsets).toContain(o);
    expect(Math.max(...tl.offsets.filter((o: number) => o < 13 * 3600))).toBeGreaterThan(11 * 3600);
  });
  it("pet: decadimento dei bisogni identico (4000 casi, anche tempo negativo e mesi di distanza)", () => {
    const diffs = decayCases.flatMap((c, i) => (decay(c[0]!, c[1]!, c[2]!) === out.decay[i] ? [] : [`${JSON.stringify(c)} TS=${decay(c[0]!, c[1]!, c[2]!)} Swift=${out.decay[i]}`]));
    expect(diffs.slice(0, 5)).toEqual([]);
  });
  it("pet: facce, bisogni, pallini, frasi e ultima cura identici su 3000+ stati (e sulle soglie esatte)", () => {
    const diffs: string[] = [];
    petCases.forEach((c, i) => {
      const ts = petWidgetModel(c.snap, c.nowMs, c.today);
      const sw = out.pet[i];
      if (!isDeepStrictEqual(ts, { hatched: sw.hatched, stage: sw.stage, name: sw.name, mood: sw.mood, needs: sw.needs, dots: sw.dots, say: sw.say, lastLine: sw.lastLine }))
        diffs.push(`#${i} TS=${JSON.stringify(ts)} Swift=${JSON.stringify(sw)}`);
    });
    expect(diffs.slice(0, 3)).toEqual([]);
    const moods = new Set(out.pet.map((p: { mood: string }) => p.mood));
    for (const m of ["egg", "asleep", "away", "love", "happy", "calm", "hungry", "waiting", "sleepy"]) expect(moods.has(m), `faccia ${m} mai provata`).toBe(true);
    const lines = out.pet.map((p: { lastLine: string | null }) => p.lastLine).filter(Boolean) as string[];
    expect(lines.some((l) => l.startsWith("Hai dato una "))).toBe(true);
    expect(lines.some((l) => l.includes("Nikole ha fatto le coccole"))).toBe(true);
  });
  it("pet: la timeline ha una voce ogni ora e gli istanti esatti (nanna, tre giorni, mezzanotte): identica a TypeScript", () => {
    const diffs = petTlCases.flatMap((c, i) => {
      const ts = petTimelineMs(c.nowMs, c.snap, c.midnights);
      return JSON.stringify(ts) === JSON.stringify(out.petTimeline[i]) ? [] : [`#${i} TS=${ts.length} voci Swift=${out.petTimeline[i]?.length}`];
    });
    expect(diffs.slice(0, 3)).toEqual([]);
    const first = out.petTimeline[0] as number[];
    expect(first.length).toBeGreaterThanOrEqual(25);
    expect(first[0]).toBe(petTlCases[0]!.nowMs);
  });
  it("pet: snapshot v4 e v3 letti uguali da Swift e TypeScript", () => {
    expect(out.snapshots.v4?.petName).toBe("Bacca");
    expect(out.snapshots.v3.petName).toBeUndefined();
  });

  it("biglietto: stesso stato, stesso contenuto, stesso 'da chi · quando' su 2500 casi (snapshot, feed, token revocato, scadenza)", () => {
    const diffs: string[] = [];
    boardCases.forEach((c, i) => {
      const feed = c.feed ? feedFromJson(JSON.parse(c.feed), 0) : null;
      const ts = noteWidgetModel(c.snap, feed, c.nowMs, c.revoked);
      const sw = out.note[i];
      const tsRow = { state: ts.state, minutesLeft: ts.minutesLeft, byLine: ts.byLine, note: ts.note ? { id: ts.note.id, kind: ts.note.kind, by: ts.note.by, byName: ts.note.byName, createdAt: ts.note.createdAt, expiresAt: ts.note.expiresAt, content: ts.note.content } : null };
      if (!isDeepStrictEqual(tsRow, { state: sw.state, minutesLeft: sw.minutesLeft, byLine: sw.byLine, note: sw.note }))
        diffs.push(`#${i} TS=${JSON.stringify(tsRow)} Swift=${JSON.stringify(sw)}`);
    });
    expect(diffs.slice(0, 3)).toEqual([]);
    const states = new Set(out.note.map((n: { state: string }) => n.state));
    expect(states.has("note") && states.has("empty")).toBe(true);
    expect(out.note.some((n: { byLine: string | null }) => n.byLine?.startsWith("da te · "))).toBe(true);
  });
  it("biglietto: scade esattamente alla scadenza (1 ms prima c'è, a 0 non c'è più)", () => {
    const base = boardCases.length - 6;
    expect(out.note[base].state).toBe("note"); // -1 ms
    expect(out.note[base + 1].state).toBe("empty"); // 0
    expect(out.note[base + 2].state).toBe("empty");
  });
  it("distanza: stato, chilometri, parole, 'aggiornata X fa' e vecchiaia identici su 2500 casi", () => {
    const diffs: string[] = [];
    boardCases.forEach((c, i) => {
      const feed = c.feed ? feedFromJson(JSON.parse(c.feed), 0) : null;
      const ts = distanceWidgetModel(c.snap, feed, c.nowMs, c.revoked);
      const sw = out.distance[i];
      if (!isDeepStrictEqual(ts, { state: sw.state, km: sw.km, near: sw.near, big: sw.big, unit: sw.unit, sentence: sw.sentence, ageText: sw.ageText, stale: sw.stale }))
        diffs.push(`#${i} TS=${JSON.stringify(ts)} Swift=${JSON.stringify(sw)}`);
    });
    expect(diffs.slice(0, 3)).toEqual([]);
    const states = new Set(out.distance.map((d: { state: string }) => d.state));
    for (const st of ["unpaired", "hidden", "mine_off", "none", "ok"]) expect(states.has(st), `stato ${st} mai provato`).toBe(true);
    const ok = out.distance.filter((d: { state: string }) => d.state === "ok");
    expect(ok.some((d: { near: boolean }) => d.near)).toBe(false); // casuali: mai vicinissimi (ci pensano i casi di confine sotto)
    expect(ok.some((d: { big: string }) => d.big.includes("."))).toBe(true); // migliaia con il punto
  });
  it("haversine e testi ('a 342 km', 'vicinissimi', '19.000 km'): Swift = TypeScript su 3000 coppie di posizioni", () => {
    const diffs: string[] = [];
    geoCases.forEach((c, i) => {
      const km = haversineKm({ latE2: c[0]!, lonE2: c[1]! }, { latE2: c[2]!, lonE2: c[3]! });
      const v = distanceView(km);
      const sw = out.geo[i];
      if (Math.abs(km - sw.km) > 1e-6 || v.near !== sw.near || v.km !== sw.kmInt || v.big !== sw.big || v.sentence !== sw.sentence)
        diffs.push(`${JSON.stringify(c)} TS=${km}/${v.sentence} Swift=${sw.km}/${sw.sentence}`);
    });
    expect(diffs.slice(0, 3)).toEqual([]);
    expect(out.geo[0].sentence).toBe("vicinissimi");
    expect(out.geo[3].sentence).toMatch(/^a 4\d\d km$/); // Roma-Milano ~ 480 km
    expect(out.geo.some((g: { big: string }) => g.big.length >= 6)).toBe(true);
  });
  it("timeline del biglietto e della distanza: identiche a TypeScript (scadenza esatta, ogni 10 min / ogni ora)", () => {
    const d1 = noteTlCases.flatMap((c, i) => (JSON.stringify(noteTimelineMs(c.nowMs, c.expiresAtMs)) === JSON.stringify(out.noteTimeline[i]) ? [] : [`#${i}`]));
    const d2 = distTlCases.flatMap((c, i) => (JSON.stringify(distanceTimelineMs(c.nowMs, c.partnerAtMs)) === JSON.stringify(out.distanceTimeline[i]) ? [] : [`#${i}`]));
    expect(d1.slice(0, 3)).toEqual([]);
    expect(d2.slice(0, 3)).toEqual([]);
    const withExp = noteTlCases.findIndex((c) => c.expiresAtMs !== null && c.expiresAtMs > c.nowMs + 3_000_000);
    const tl = out.noteTimeline[withExp] as number[];
    expect(tl[tl.length - 1]).toBe(noteTlCases[withExp]!.expiresAtMs! + 1000); // l'ultima voce è un attimo DOPO la scadenza
  });
  it("snapshot v5 letto uguale da Swift e TypeScript (biglietto, posizioni, feed)", () => {
    const sw = out.snapshots.v5;
    expect(sw.noteBy).toBe("partner");
    expect(sw.noteContent.strokes.length).toBe(2);
    expect(sw.feedToken).toMatch(/^[0-9a-f]{64}$/);
    expect(out.snapshots.v4.noteId).toBeUndefined();
  });
});
