import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Controlli statici sul Swift del widget (nessun Mac qui): palette allineata ai token TypeScript, nessuna API più
 * nuova di iOS 16.4 senza guardia, font dichiarati e presenti, kind dei widget stabili.
 */
const root = path.resolve(__dirname, "..");
const dir = path.join(root, "targets/widget");
const swiftFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".swift"));
const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
const all = Object.fromEntries(swiftFiles.map((f) => [f, read(f)]));

describe("palette Swift ↔ token TypeScript", () => {
  const tokens = fs.readFileSync(path.join(root, "src/design/tokens.ts"), "utf8");
  const ts = Object.fromEntries(
    [...(/export const palette = \{([\s\S]*?)\} as const;/.exec(tokens)?.[1] ?? "").matchAll(/(\w+): "#([0-9A-Fa-f]{6})"/g)].map(
      (m) => [m[1], m[2].toUpperCase()],
    ),
  );
  const sw = Object.fromEntries(
    [...all["Palette.swift"].matchAll(/static let (\w+) = Color\(hex: 0x([0-9A-Fa-f]{6})\)/g)].map((m) => [
      m[1],
      m[2].toUpperCase(),
    ]),
  );
  it("ogni colore Swift esiste nei token con lo stesso valore", () => {
    expect(Object.keys(sw).length).toBeGreaterThanOrEqual(13);
    for (const [name, hex] of Object.entries(sw)) expect(ts[name], `P.${name}`).toBe(hex);
  });
  it("ogni colore dei token è anche in Swift", () => {
    for (const name of Object.keys(ts)) expect(sw[name], `token ${name} manca in Palette.swift`).toBeDefined();
  });
  it("niente viola e niente gradienti nel Swift", () => {
    for (const [f, src] of Object.entries(all)) {
      expect(src, f).not.toMatch(/LinearGradient|RadialGradient|AngularGradient|\.blur\(|\.shadow\(|Material|ultraThin/);
    }
  });
});

describe("compatibilità iOS 16.4 (revisione statica)", () => {
  it("nessun #Preview, @Observable, AppIntent, onChange a due parametri", () => {
    for (const [f, src] of Object.entries(all)) {
      expect(src, f).not.toMatch(/#Preview|@Observable|AppIntent|import AppIntents|Toggle\(.*intent:|Button\(intent:/);
      expect(src, f).not.toMatch(/\.onChange\(of:[^{]*\{\s*(_|\w+),\s*(_|\w+)\s+in/);
    }
  });
  it("ogni containerBackground sta dentro #available(iOS 17.0, *)", () => {
    for (const [f, src] of Object.entries(all)) {
      const lines = src.split("\n");
      lines.forEach((l, i) => {
        if (!l.includes("containerBackground") || l.trim().startsWith("//")) return;
        const before = lines.slice(Math.max(0, i - 6), i).join("\n");
        expect(before, `${f}:${i + 1}`).toMatch(/#available\(iOS 17\.0, \*\)/);
      });
    }
  });
  it("contentMarginsDisabled / widgetAccentable / API 17+ solo con guardia", () => {
    for (const [f, src] of Object.entries(all)) {
      if (/contentMarginsDisabled|\.invalidatableContent|ContentUnavailableView|@Bindable/.test(src))
        expect(src, f).toMatch(/#available\(iOS 17\.0, \*\)/);
    }
  });
  it("tutti i simboli SF usati esistono da iOS 15/16", () => {
    const ok = new Set(["heart.fill", "clock", "moon.zzz.fill", "fork.knife", "moon.fill"]);
    for (const [f, src] of Object.entries(all))
      for (const m of src.matchAll(/(?:systemName|systemImage): "([^"]+)"/g)) expect(ok.has(m[1]), `${f}: ${m[1]}`).toBe(true);
  });
  it("niente emoji nel codice Swift (DESIGN.md: niente emoji come icone)", () => {
    for (const [f, src] of Object.entries(all)) expect(src, f).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("font, kind e bundle", () => {
  it("i font dichiarati in Info.plist e in FontLoader esistono in assets/", () => {
    const plist = read("Info.plist");
    const listed = [...plist.matchAll(/<string>([\w-]+\.ttf)<\/string>/g)].map((m) => m[1]);
    expect(listed.length).toBe(4);
    for (const f of listed) expect(fs.existsSync(path.join(dir, "assets", f)), f).toBe(true);
    const loader = [...all["Palette.swift"].matchAll(/static let files = \[([^\]]*)\]/g)][0][1];
    for (const n of [...loader.matchAll(/"([\w-]+)"/g)].map((m) => m[1])) expect(listed).toContain(`${n}.ttf`);
  });
  it("nomi PostScript dei font verificati sui TTF", () => {
    const names = ["BagelFatOne-Regular", "Figtree-SemiBold", "Figtree-Bold", "Figtree-ExtraBold"];
    for (const [file, ps] of [
      ["BagelFatOne.ttf", names[0]],
      ["Figtree-SemiBold.ttf", names[1]],
      ["Figtree-Bold.ttf", names[2]],
      ["Figtree-ExtraBold.ttf", names[3]],
    ]) {
      const bin = fs.readFileSync(path.join(dir, "assets", file));
      expect(bin.toString("latin1").includes(ps) || bin.toString("utf16le").includes(ps) || hasUtf16Be(bin, ps), file).toBe(true);
      expect(all["Palette.swift"], ps).toContain(`"${ps}"`);
    }
  });
  it("kind: quello storico resta, gli altri sono unici e tutti nel bundle", () => {
    const kinds = Object.values(all).flatMap((s) => [...s.matchAll(/let kind = "(\w+)"/g)].map((m) => m[1]));
    expect(kinds).toContain("FragolinaWidget");
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds.sort()).toEqual(
      ["FragolinaDays", "FragolinaDistance", "FragolinaLock", "FragolinaLockMood", "FragolinaMood", "FragolinaNote", "FragolinaPet", "FragolinaPing", "FragolinaWidget"].sort(),
    );
    const bundle = all["index.swift"];
    for (const w of ["MoodWidget", "PingWidget", "DaysWidget", "LockWidget", "LockMoodWidget", "PetWidget", "NoteWidget", "DistanceWidget", "FragolinaWidget"])
      expect(bundle, w).toContain(`${w}()`);
  });
  it("i link usati nei widget sono quelli che l'app capisce", () => {
    const urls = [...all["Model.swift"].matchAll(/URL\(string: "(fragolina:\/\/\w+)"\)/g)].map((m) => m[1]).sort();
    expect(urls).toEqual(["fragolina://draw", "fragolina://home", "fragolina://mood", "fragolina://pet", "fragolina://ping", "fragolina://us"]);
  });
  it("la rete (Percorso B) vive in UN solo file: Feed.swift, con timeout ≤ 8 s e senza service_role", () => {
    for (const [f, src] of Object.entries(all)) {
      if (f === "Feed.swift") continue;
      expect(src, f).not.toMatch(/URLSession|URLRequest\(|AsyncImage|dataTask/);
    }
    const feed = all["Feed.swift"];
    expect(feed).toMatch(/static let timeout: TimeInterval = 8\b/);
    expect(feed).toContain("/rest/v1/rpc/widget_feed");
    expect(feed).not.toMatch(/service_role/);
    expect(feed).toMatch(/waitsForConnectivity = false/);
  });
  it("niente rete in galleria/anteprima: i provider usano il segnaposto quando `isPreview`", () => {
    const p = all["Provider.swift"];
    expect((p.match(/context\.isPreview/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(p).toMatch(/policy: \.after\(now\.addingTimeInterval\(feedRefresh\)\)/);
    expect(p).toMatch(/feedRefresh: TimeInterval = 15 \* 60/);
  });
  it("il segnaposto non si ferma mai su un'immagine mancante e il nome dei kind nuovi è stabile", () => {
    expect(all["NoteWidget.swift"]).toContain('let kind = "FragolinaNote"');
    expect(all["DistanceWidget.swift"]).toContain('let kind = "FragolinaDistance"');
    expect(all["NoteWidget.swift"]).toMatch(/supportedFamilies\(\[\.systemSmall, \.systemMedium, \.accessoryRectangular\]\)/);
    expect(all["DistanceWidget.swift"]).toMatch(/supportedFamilies\(\[\.systemSmall, \.systemMedium, \.accessoryCircular, \.accessoryInline\]\)/);
  });
  it("il WidgetBundle è diviso in pacchetti da massimo 5 (limite del costruttore): il pet sparito dalla galleria", () => {
    const idx = all["index.swift"];
    const bundles = [...idx.matchAll(/struct (\w+): WidgetBundle \{\s*var body: some Widget \{([\s\S]*?)\n    \}\n\}/g)];
    expect(bundles.length).toBeGreaterThanOrEqual(3);
    for (const b of bundles) {
      const n = [...b[2].matchAll(/^\s+\w+(?:\(\))?(?:\.body)?\s*$/gm)].length;
      expect(n, b[1]).toBeLessThanOrEqual(5);
    }
    expect(idx).toMatch(/@main\s+struct FragolinaWidgetBundle/);
  });
});

function hasUtf16Be(bin: Buffer, s: string) {
  const be = Buffer.alloc(s.length * 2);
  for (let i = 0; i < s.length; i++) be.writeUInt16BE(s.charCodeAt(i), i * 2);
  return bin.includes(be);
}

describe("widget del pet (sessione 4)", () => {
  it("il kind FragolinaPet è nel bundle e usa tutte le famiglie previste (iOS 16: niente interattivo)", () => {
    expect(all["PetWidget.swift"]).toContain('let kind = "FragolinaPet"');
    expect(all["PetWidget.swift"]).toMatch(/supportedFamilies\(\[\.systemSmall, \.systemMedium, \.accessoryRectangular\]\)/);
    expect(all["PetWidget.swift"]).not.toMatch(/Button\(|Toggle\(/);
  });
  it("il widget tocca fragolina://pet in ogni famiglia", () => {
    const n = (all["PetWidget.swift"].match(/widgetURL\(WidgetLink\.pet\)/g) ?? []).length;
    expect(n).toBeGreaterThanOrEqual(3);
  });
  it("la timeline del pet ha un provider suo, con voci orarie", () => {
    expect(all["Provider.swift"]).toContain("struct PetProvider: TimelineProvider");
    expect(all["Model.swift"]).toMatch(/for i in 1\.\.\.24 \{ out\.append\(now\.addingTimeInterval\(Double\(i\) \* 3600\)\) \}/);
  });
  it("le costanti delle regole del pet in Swift sono quelle di TypeScript", async () => {
    const r = await import("@/lib/pet/rules");
    const m = all["Model.swift"];
    const num = (name: string) => Number(new RegExp(`static let ${name}(?:: Double)? = ([0-9._* ]+)`).exec(m)?.[1]?.replace(/_/g, "").split("*").map(Number).reduce((a, b) => a * b, 1));
    expect(num("decayFood")).toBe(r.DECAY_PER_HOUR.food);
    expect(num("decayLove")).toBe(r.DECAY_PER_HOUR.love);
    expect(num("decayEnergy")).toBe(r.DECAY_PER_HOUR.energy);
    expect(num("lowNeed")).toBe(r.LOW_NEED);
    expect(num("happyAvg")).toBe(r.HAPPY_AVG);
    expect(num("awayAfterMs")).toBe(r.AWAY_AFTER_MS);
  });
  it("ogni stadio e ogni faccia dell'app esistono anche nel disegno Swift", () => {
    const f = all["PetFaces.swift"];
    for (const st of ["seed", "sprout", "berry", "big", "egg"]) expect(f, st).toContain(`"${st}"`);
    for (const mood of ["happy", "love", "sleepy", "asleep", "hungry", "waiting"]) expect(f, mood).toContain(`"${mood}"`);
  });
});
