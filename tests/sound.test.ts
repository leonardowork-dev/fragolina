import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetSoundForTests,
  play,
  preloadSounds,
  SOUND_MIN_GAP_MS,
  SOUND_VOLUME,
} from "@/lib/sound";
import { useSettings } from "@/state/settingsStore";
import { RATE, SOUND_IDS } from "../scripts/make-sounds.mjs";

const { created, audioState, platform } = vi.hoisted(() => ({
  created: [] as { src: unknown; volume: number }[],
  audioState: { failCreate: false, failMode: false, failSeek: false, failPlay: false },
  platform: { OS: "ios" },
}));

vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("@/lib/soundSources", () => {
  const ids = [
    "pop",
    "plink",
    "paper",
    "chew",
    "carezza",
    "snore",
    "grow",
    "fanfara",
    "tok",
    "pareggio",
    "rivela",
    "scatto",
    "festa",
  ];
  return { SOUND_SOURCES: Object.fromEntries(ids.map((i, n) => [i, n + 1])) };
});
vi.mock("expo-audio", () => ({
  setAudioModeAsync: vi.fn((mode: unknown) => {
    (globalThis as { __mode?: unknown }).__mode = mode;
    if (audioState.failMode) throw new Error("mode");
    return Promise.resolve();
  }),
  createAudioPlayer: vi.fn((src: unknown) => {
    if (audioState.failCreate) throw new Error("create");
    const p = {
      src,
      volume: 1,
      seekTo: vi.fn(() =>
        audioState.failSeek ? Promise.reject(new Error("seek")) : Promise.resolve(),
      ),
      play: vi.fn(() => {
        if (audioState.failPlay) throw new Error("play");
      }),
    };
    created.push(p);
    return p;
  }),
}));

const ROOT = path.resolve(__dirname, "..");
const SOUND_DIR = path.join(ROOT, "assets", "sounds");

describe("file dei suoni", () => {
  const sourcesText = fs.readFileSync(path.join(ROOT, "src/lib/soundSources.ts"), "utf8");
  const mapped = [
    ...sourcesText.matchAll(/^\s+(\w+): require\("\.\.\/\.\.\/assets\/sounds\/(\w+)\.wav"\)/gm),
  ];

  it("ogni id mappato ha il suo file, e lo script genera esattamente quelli", () => {
    expect(mapped.length).toBeGreaterThan(8);
    for (const [, id, file] of mapped) {
      expect(file).toBe(id);
      expect(fs.existsSync(path.join(SOUND_DIR, `${file}.wav`)), `${file}.wav`).toBe(true);
    }
    expect(mapped.map((m) => m[1]).sort()).toEqual([...SOUND_IDS].sort());
    const onDisk = fs
      .readdirSync(SOUND_DIR)
      .filter((f) => f.endsWith(".wav"))
      .map((f) => f.replace(".wav", ""));
    expect(onDisk.sort()).toEqual([...SOUND_IDS].sort());
  });

  it("ogni suono usato nel codice esiste, e ogni suono mappato è usato", () => {
    const ids = new Set(mapped.map((m) => m[1]!));
    const used = new Set<string>();
    const text: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) walk(f);
        else if (/\.tsx?$/.test(e.name) && !/soundSources|[\\/]sound\.ts$/.test(f)) {
          const t = fs.readFileSync(f, "utf8");
          text.push(t);
          for (const m of t.matchAll(/\bsound="(\w+)"/g)) used.add(m[1]!);
          for (const m of t.matchAll(/\bplay\("(\w+)"\)/g)) used.add(m[1]!);
        }
      }
    };
    walk(path.join(ROOT, "src"));
    walk(path.join(ROOT, "app"));
    expect(used.size).toBeGreaterThan(8);
    for (const u of used) expect(ids.has(u), `suono sconosciuto: ${u}`).toBe(true);
    const all = text.join("\n");
    for (const id of ids) expect(all.includes(`"${id}"`), `suono mai usato: ${id}`).toBe(true);
  });

  for (const id of SOUND_IDS as string[]) {
    it(`${id}.wav: mono 16 bit, < 0,6 s, < 60 KB, picco −6 dBFS, senza click ai bordi`, () => {
      const b = fs.readFileSync(path.join(SOUND_DIR, `${id}.wav`));
      expect(b.length).toBeLessThan(60 * 1024);
      expect(b.toString("ascii", 0, 4)).toBe("RIFF");
      expect(b.readUInt16LE(22)).toBe(1); // mono
      expect(b.readUInt32LE(24)).toBe(RATE);
      expect(b.readUInt16LE(34)).toBe(16);
      const n = b.readUInt32LE(40) / 2;
      expect(n / RATE).toBeLessThan(0.6);
      expect(n / RATE).toBeGreaterThan(0.05);
      let peak = 0;
      for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(b.readInt16LE(44 + i * 2)));
      expect(peak / 32767).toBeLessThanOrEqual(0.5 + 1e-3); // −6 dBFS
      expect(peak / 32767).toBeGreaterThan(0.45);
      expect(Math.abs(b.readInt16LE(44))).toBeLessThan(30);
      expect(Math.abs(b.readInt16LE(44 + (n - 1) * 2))).toBeLessThan(30);
    });
  }
});

describe("play", () => {
  let clock = 1_000_000;
  beforeEach(() => {
    created.length = 0;
    audioState.failCreate = audioState.failMode = audioState.failSeek = audioState.failPlay = false;
    platform.OS = "ios";
    useSettings.setState({ sounds: true });
    clock = 1_000_000;
    __resetSoundForTests(() => clock);
  });

  it("rispetta il silenzioso di iOS e non interrompe la musica", () => {
    play("pop");
    const mode = (globalThis as { __mode?: Record<string, unknown> }).__mode!;
    expect(mode.playsInSilentMode).toBe(false);
    expect(mode.interruptionMode).toBe("mixWithOthers");
    expect(mode.allowsRecording).toBe(false);
    expect(mode.shouldPlayInBackground).toBe(false);
  });

  it("suona a volume basso, un player per suono, e riusa il player", () => {
    expect(play("pop")).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0]!.volume).toBe(SOUND_VOLUME);
    expect(SOUND_VOLUME).toBeLessThanOrEqual(0.6);
    clock += SOUND_MIN_GAP_MS + 1;
    play("pop");
    expect(created).toHaveLength(1);
  });

  it("cancello di frequenza: lo stesso suono al massimo ogni 120 ms, suoni diversi no", () => {
    expect(play("tok")).toBe(true);
    clock += 50;
    expect(play("tok")).toBe(false);
    expect(play("plink")).toBe(true);
    clock += 69;
    expect(play("tok")).toBe(false);
    clock += 1;
    expect(play("tok")).toBe(true);
  });

  it("impostazione Suoni spenta: silenzio e nessun player creato", () => {
    useSettings.setState({ sounds: false });
    expect(play("pop")).toBe(false);
    preloadSounds();
    expect(created).toHaveLength(0);
  });

  it('"Meno movimento" non spegne i suoni', () => {
    useSettings.setState({ reduceMotionOverride: true });
    expect(play("pop")).toBe(true);
    useSettings.setState({ reduceMotionOverride: null });
  });

  it("sul web non fa nulla", () => {
    platform.OS = "web";
    expect(play("pop")).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("mai lancia, qualunque cosa succeda al modulo audio", async () => {
    audioState.failCreate = true;
    expect(() => play("pop")).not.toThrow();
    audioState.failCreate = false;
    audioState.failMode = true;
    __resetSoundForTests(() => clock);
    expect(() => play("pop")).not.toThrow();
    audioState.failMode = false;
    audioState.failSeek = true;
    audioState.failPlay = true;
    __resetSoundForTests(() => clock);
    expect(() => play("plink")).not.toThrow();
    expect(() => preloadSounds()).not.toThrow();
    await new Promise((r) => setTimeout(r, 5));
  });

  it("preload prepara un player per ogni suono", () => {
    preloadSounds();
    expect(created).toHaveLength(13);
  });
});
