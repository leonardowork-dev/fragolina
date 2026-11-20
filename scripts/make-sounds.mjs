// Genera i suoni di Fragolina (originali, sintesi pura: nessun file scaricato, nessuna licenza).
// Uso: npm run sounds:gen  →  assets/sounds/*.wav (mono, 22050 Hz, 16 bit, < 0,6 s, < 60 KB, picco −6 dBFS).
// Deterministico: il "rumore" viene da un generatore con seme fisso, quindi gli stessi byte a ogni esecuzione.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "sounds");
export const RATE = 22050;
export const PEAK = 0.5; // −6 dBFS
const TAU = Math.PI * 2;

// Rumore deterministico (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const buf = (sec) => new Float64Array(Math.round(sec * RATE));
/** Inviluppo: attacco lineare breve, caduta esponenziale. */
const env = (t, atk, decay) => (t < atk ? t / atk : Math.exp(-(t - atk) / decay));

/** Aggiunge una nota (sinusoide con un po' di seconda armonica) a partire da `at` secondi. */
function note(
  b,
  at,
  freq,
  dur,
  { atk = 0.006, decay = 0.08, gain = 1, harm = 0.25, glide = 0 } = {},
) {
  const start = Math.round(at * RATE);
  const n = Math.min(Math.round(dur * RATE), b.length - start);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = freq * (1 + glide * (t / dur));
    phase += (TAU * f) / RATE;
    b[start + i] += gain * env(t, atk, decay) * (Math.sin(phase) + harm * Math.sin(2 * phase));
  }
}

/** Rumore filtrato (passa-basso a un polo + passa-alto) con inviluppo: fruscii, masticate. */
function noise(
  b,
  at,
  dur,
  { atk = 0.01, decay = 0.05, gain = 1, lp = 0.3, hp = 0.02, seed = 1 } = {},
) {
  const r = rng(seed);
  const start = Math.round(at * RATE);
  const n = Math.min(Math.round(dur * RATE), b.length - start);
  let l = 0;
  let h = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const x = r() * 2 - 1;
    l += lp * (x - l);
    h += hp * (l - h);
    b[start + i] += gain * env(t, atk, decay) * (l - h);
  }
}

/** Normalizza al picco, dissolvenze di 6 ms (nessun click all'inizio e alla fine), 16 bit. */
function finish(b) {
  const fade = Math.round(0.006 * RATE);
  const faded = Float64Array.from(b, (v, i) => {
    let g = 1;
    if (i < fade) g *= i / fade;
    if (b.length - 1 - i < fade) g *= (b.length - 1 - i) / fade;
    return v * g;
  });
  let max = 0;
  for (const v of faded) max = Math.max(max, Math.abs(v));
  const k = max > 0 ? PEAK / max : 1;
  return Int16Array.from(faded, (v) =>
    Math.max(-32768, Math.min(32767, Math.round(v * k * 32767))),
  );
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// Do maggiore, note in Hz.
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

/** id → sintesi. Gli id sono quelli di `src/lib/sound.ts`. */
export const SOUNDS = {
  // Penso a te: un "pop" tondo che sale.
  pop: () => {
    const b = buf(0.16);
    note(b, 0, 420, 0.16, { atk: 0.004, decay: 0.045, glide: 0.9, harm: 0.1 });
    return b;
  },
  // Umore scelto: un campanellino piccolo (due armoniche).
  plink: () => {
    const b = buf(0.4);
    note(b, 0, 1318.5, 0.4, { decay: 0.11, harm: 0, gain: 0.8 });
    note(b, 0, 1975.5, 0.4, { decay: 0.07, harm: 0, gain: 0.35 });
    return b;
  },
  // Biglietto inviato: fruscio di carta + un tocco.
  paper: () => {
    const b = buf(0.3);
    noise(b, 0, 0.3, { atk: 0.03, decay: 0.07, lp: 0.55, hp: 0.12, gain: 1, seed: 7 });
    noise(b, 0.1, 0.18, { atk: 0.02, decay: 0.04, lp: 0.45, hp: 0.1, gain: 0.7, seed: 11 });
    note(b, 0.17, 880, 0.12, { decay: 0.03, harm: 0, gain: 0.25 });
    return b;
  },
  // Pet nutrito: tre "mastica" bassi con un po' di rumore.
  chew: () => {
    const b = buf(0.5);
    for (let i = 0; i < 3; i++) {
      const at = i * 0.15;
      note(b, at, 210 - i * 14, 0.11, { atk: 0.004, decay: 0.03, glide: -0.3, harm: 0.4 });
      noise(b, at, 0.07, { atk: 0.002, decay: 0.015, lp: 0.4, hp: 0.05, gain: 0.5, seed: 21 + i });
    }
    return b;
  },
  // Pet accarezzato: un "mmh" morbido che respira.
  carezza: () => {
    const b = buf(0.45);
    const n = b.length;
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      phase += (TAU * (330 + 18 * Math.sin(TAU * 5 * t))) / RATE;
      const e = Math.sin(Math.PI * (i / n)) ** 1.5;
      b[i] =
        e * (Math.sin(phase) + 0.2 * Math.sin(2 * phase)) * (0.8 + 0.2 * Math.sin(TAU * 7 * t));
    }
    return b;
  },
  // Pet che russa piano (nanna): due respiri bassi.
  snore: () => {
    const b = buf(0.58);
    for (const at of [0.02, 0.32]) {
      noise(b, at, 0.26, {
        atk: 0.09,
        decay: 0.07,
        lp: 0.07,
        hp: 0.004,
        gain: 3,
        seed: 5 + Math.round(at * 100),
      });
      note(b, at, 110, 0.26, { atk: 0.08, decay: 0.07, harm: 0.3, gain: 0.5 });
    }
    return b;
  },
  // Pet cresciuto: quattro note che salgono.
  grow: () => {
    const b = buf(0.55);
    [C5, E5, G5, C6].forEach((f, i) => note(b, i * 0.09, f, 0.3, { decay: 0.08, gain: 0.8 }));
    return b;
  },
  // Fanfara corta da 3 note (schiusa, vittoria, evento "è oggi").
  fanfara: () => {
    const b = buf(0.58);
    note(b, 0, C5, 0.18, { decay: 0.07, gain: 0.8 });
    note(b, 0.12, E5, 0.18, { decay: 0.07, gain: 0.8 });
    note(b, 0.24, G5, 0.34, { decay: 0.13, gain: 1 });
    note(b, 0.24, C6, 0.34, { decay: 0.1, gain: 0.35, harm: 0 });
    return b;
  },
  // Mossa nei giochi: "tok" di legno.
  tok: () => {
    const b = buf(0.12);
    note(b, 0, 300, 0.12, { atk: 0.002, decay: 0.022, glide: -0.35, harm: 0.5 });
    noise(b, 0, 0.03, { atk: 0.001, decay: 0.006, lp: 0.5, hp: 0.05, gain: 0.35, seed: 3 });
    return b;
  },
  // Pareggio: due note uguali, gentili.
  pareggio: () => {
    const b = buf(0.4);
    note(b, 0, 440, 0.2, { decay: 0.07, gain: 0.8 });
    note(b, 0.17, 440, 0.22, { decay: 0.08, gain: 0.7 });
    return b;
  },
  // Domanda rivelata: carta che si gira (fruscio) + plink.
  rivela: () => {
    const b = buf(0.38);
    noise(b, 0, 0.14, { atk: 0.05, decay: 0.03, lp: 0.5, hp: 0.15, gain: 0.8, seed: 17 });
    note(b, 0.13, 1174.7, 0.25, { decay: 0.08, harm: 0, gain: 0.9 });
    note(b, 0.13, 1760, 0.25, { decay: 0.05, harm: 0, gain: 0.3 });
    return b;
  },
  // Foto nell'album: "scatto" piccolo, due click.
  scatto: () => {
    const b = buf(0.22);
    noise(b, 0, 0.02, { atk: 0.001, decay: 0.005, lp: 0.7, hp: 0.2, gain: 1, seed: 31 });
    note(b, 0, 1500, 0.04, { atk: 0.001, decay: 0.008, harm: 0, gain: 0.3 });
    noise(b, 0.09, 0.03, { atk: 0.001, decay: 0.008, lp: 0.55, hp: 0.15, gain: 0.7, seed: 33 });
    note(b, 0.09, 900, 0.06, { atk: 0.001, decay: 0.012, harm: 0, gain: 0.25 });
    return b;
  },
  // Coppia collegata (festa): scala corta e nota lunga, più ricca.
  festa: () => {
    const b = buf(0.58);
    [C5, E5, G5].forEach((f, i) => note(b, i * 0.08, f, 0.22, { decay: 0.07, gain: 0.6 }));
    [G5, C6].forEach((f) => note(b, 0.26, f, 0.34, { decay: 0.12, gain: 0.55, harm: 0.1 }));
    note(b, 0.26, E5 * 2, 0.34, { decay: 0.1, gain: 0.3, harm: 0 });
    return b;
  },
};

export const SOUND_IDS = Object.keys(SOUNDS);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of SOUND_IDS) {
    const bytes = wav(finish(SOUNDS[id]()));
    fs.writeFileSync(path.join(OUT, `${id}.wav`), bytes);
    console.log(`${id}.wav  ${(bytes.length / 1024).toFixed(1)} KB`);
  }
}
