// Prova opzionale del codice Swift PURO del widget (targets/widget/Model.swift) con un compilatore Swift su Linux/Mac.
// Confronta Swift e TypeScript sulle stesse fixture e su migliaia di casi casuali (ricorrenze, giorni, "X fa", snapshot).
// Uso: SWIFTC=/percorso/swiftc npm run swift:check   (senza SWIFTC cerca `swiftc` nel PATH; se manca, salta con codice 0)
// Su WSL senza sudo servono sysroot e librerie: vedi KNOWN_ISSUES.md ("Prova Swift su Linux"). SWIFTC può essere uno script.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const swiftc = process.env.SWIFTC || "swiftc";
const probe = spawnSync(swiftc, ["--version"], { encoding: "utf8" });
if (probe.error || probe.status !== 0) {
  console.log("swift-check: nessun compilatore Swift (imposta SWIFTC). Salto.");
  process.exit(0);
}

// Carica TypeScript senza bundler: usa tsx se c'è, altrimenti il type-stripping di Node.
const rec = await import(path.join(root, "src/lib/recurrence.ts"));
const timeLib = await import(path.join(root, "src/lib/time.ts"));
const payload = await import(path.join(root, "src/lib/widgetPayload.ts")).catch(() => null);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fragolina-swift-"));
const bin = path.join(tmp, "check");
execFileSync(swiftc, [path.join(root, "targets/widget/Model.swift"), path.join(root, "tests/swift/main.swift"), "-o", bin], { stdio: "inherit" });

// ---------- ingressi ----------
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pad = (n, w = 2) => String(n).padStart(w, "0");
const iso = ([y, m, d]) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
const randDay = (from, to) => rec.civilFromDays(Math.floor(rec.daysFromCivil(...from) + rnd() * (rec.daysFromCivil(...to) - rec.daysFromCivil(...from))));
const recCases = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/recurrence-cases.json"), "utf8")).map((c) => ({ start: c.start, today: c.today }));
for (let i = 0; i < 4000; i++) {
  const s = randDay([1995, 1, 1], [2026, 11, 30]);
  const t = randDay(s, [2060, 12, 31]);
  recCases.push({ start: iso(s), today: iso(t) });
}
for (let i = 0; i < 400; i++) {
  // fine mese e bisestili: giorni 28-31 e il 29 febbraio
  const y = 2000 + Math.floor(rnd() * 30);
  const m = 1 + Math.floor(rnd() * 12);
  const d = Math.min(rec.daysInMonthYmd(y, m), 28 + Math.floor(rnd() * 4));
  const s = [y, m, d];
  recCases.push({ start: iso(s), today: iso(randDay(s, [y + 6, 12, 31])) });
}
const ago = [0, 1, 44, 45, 59, 60, 89, 90, 3599, 3600, 5399, 5400, 7200, 86399, 86400, 129599, 129600, 172800, 6 * 86400];
for (let i = 0; i < 500; i++) ago.push(Math.floor(rnd() * 20 * 86400));
const fx = (n) => fs.readFileSync(path.join(root, "tests/fixtures", n), "utf8");
const snapshots = {
  v3: fx("widget-snapshot.json"),
  v2: fx("widget-snapshot-v2.json"),
  v1: fx("widget-snapshot-v1.json"),
  futuro: '{"v":9,"updatedAt":5,"partnerName":"N","nuovo":{"a":[1,2]},"questionMineDone":true}',
  tipiSbagliati: '{"v":"x","updatedAt":"ieri","paired":"si","partnerName":3,"thinkingToday":"tre","myMoodAt":"mai","questionMineDone":"sì"}',
  vuoto: "{}",
  nonJson: "{rotto",
  accenti: JSON.stringify({ v: 3, partnerName: "Zoë Àngela 🍓", questionText: "È già tardi?" }),
};
const nowMs = Date.UTC(2026, 10, 12, 20, 15, 0);
const input = { recurrence: recCases, days: recCases, ago, snapshots, timeline: { nowMs, updatedAtMs: nowMs - 3600_000 } };
fs.writeFileSync(path.join(tmp, "in.json"), JSON.stringify(input));
execFileSync(bin, [path.join(tmp, "in.json"), path.join(tmp, "out.json")], { stdio: "inherit" });
const out = JSON.parse(fs.readFileSync(path.join(tmp, "out.json"), "utf8"));

// ---------- confronti ----------
let bad = 0;
const fail = (m) => { if (bad++ < 25) console.error("DIVERSO:", m); };
recCases.forEach((c, i) => {
  const ts = rec.nextRecurrence(c.start, c.today);
  const sw = out.recurrence[i];
  const a = ts ? { date: ts.date, daysUntil: ts.daysUntil, kind: ts.kind, count: ts.count, label: ts.label } : null;
  if (JSON.stringify(a) !== JSON.stringify(sw)) fail(`ricorrenza ${JSON.stringify(c)} TS=${JSON.stringify(a)} Swift=${JSON.stringify(sw)}`);
  const dts = rec.daysTogether(c.start, c.today);
  if (dts !== out.days[i]) fail(`giorni ${JSON.stringify(c)} TS=${dts} Swift=${out.days[i]}`);
});
ago.forEach((s, i) => {
  const ts = timeLib.timeAgo(0, s * 1000);
  if (ts !== out.ago[i].ago) fail(`ago ${s}s TS="${ts}" Swift="${out.ago[i].ago}"`);
});
if (payload) {
  for (const [name, raw] of Object.entries(snapshots)) {
    const sw = out.snapshots[name];
    const ts = payload.decodeSnapshot(raw);
    if (sw === null || sw === undefined) {
      if (name !== "nonJson") fail(`snapshot ${name}: Swift non l'ha letto`);
      if (ts !== null && name === "nonJson") fail("nonJson letto da TS");
      continue;
    }
    for (const [k, v] of Object.entries(sw)) if (JSON.stringify(ts?.[k]) !== JSON.stringify(v)) fail(`snapshot ${name}.${k} TS=${JSON.stringify(ts?.[k])} Swift=${JSON.stringify(v)}`);
  }
}
const tl = out.timeline;
if (!tl.sorted) fail("timeline non ordinata");
if (tl.offsets[0] !== 0) fail("timeline: la prima voce non è adesso");
const need = [2 * 3600 + 1, 47 * 3600 + 1].map((x) => x); // soglie rispetto a updatedAt = now - 1h
for (const o of [2 * 3600 + 1, 47 * 3600 + 1]) if (!tl.offsets.includes(o)) fail(`timeline: manca la soglia a +${o}s`);
if (!tl.offsets.some((o) => o > 3 * 3600 + 17 * 1800)) fail("timeline: non arriva a 12 h");
console.log(`swift-check: ${recCases.length} ricorrenze/giorni, ${ago.length} "X fa", ${Object.keys(snapshots).length} snapshot, timeline ${tl.count} voci → ${bad === 0 ? "TUTTO UGUALE" : bad + " DIFFERENZE"}`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(bad === 0 ? 0 : 1);
