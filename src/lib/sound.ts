import * as ExpoAudio from "expo-audio";
import { Platform } from "react-native";

import { useSettings } from "@/state/settingsStore";

import { SOUND_SOURCES, type SoundId } from "./soundSources";

export type { SoundId };

/**
 * Suoni: piccoli, originali (generati in `scripts/make-sounds.mjs`), un suono per azione dell'utente, sullo stesso
 * frame dell'aptica e mai come unico feedback. Mai sulle tab né sullo scroll.
 *
 * - Rispetta l'interruttore silenzioso di iOS (`playsInSilentMode: false`) e non interrompe la musica
 *   (`mixWithOthers`).
 * - Mai blocca e mai lancia: ogni errore è silenzioso. Sul web non fa nulla (nessun file da caricare, e-2-e muti).
 * - Cancello di frequenza: lo stesso suono al massimo una volta ogni 120 ms (carezze e mosse veloci).
 * - "Meno movimento" NON spegne i suoni: li spegne solo l'impostazione "Suoni".
 */
export const SOUND_VOLUME = 0.55;
export const SOUND_MIN_GAP_MS = 120;

type Player = {
  volume: number;
  play: () => void;
  seekTo: (s: number) => Promise<void>;
  remove?: () => void;
};
type Audio = typeof ExpoAudio;

const players = new Map<SoundId, Player>();
const lastPlayed = new Map<SoundId, number>();
let audio: Audio | null = null;
let ready = false;
let now = () => Date.now();

const enabled = () => Platform.OS !== "web" && useSettings.getState().sounds;

function load(): Audio | null {
  if (audio) return audio;
  // Un modulo nativo mancante (es. dev client vecchio) non deve mai rompere l'app: si resta muti.
  audio = typeof ExpoAudio?.createAudioPlayer === "function" ? ExpoAudio : null;
  return audio;
}

function init(): boolean {
  if (ready) return true;
  const a = load();
  if (!a) return false;
  try {
    void a
      .setAudioModeAsync({
        playsInSilentMode: false,
        interruptionMode: "mixWithOthers",
        allowsRecording: false,
        shouldPlayInBackground: false,
      })
      .catch(() => {});
    ready = true;
  } catch {
    return false;
  }
  return ready;
}

function playerFor(id: SoundId): Player | null {
  const have = players.get(id);
  if (have) return have;
  const a = load();
  if (!a) return null;
  try {
    const p = a.createAudioPlayer(SOUND_SOURCES[id]) as unknown as Player;
    p.volume = SOUND_VOLUME;
    players.set(id, p);
    return p;
  } catch {
    return null;
  }
}

/** Prepara i player (una volta, all'avvio, dopo il caricamento delle impostazioni). Mai lancia. */
export function preloadSounds(): void {
  try {
    if (!enabled() || !init()) return;
    for (const id of Object.keys(SOUND_SOURCES) as SoundId[]) playerFor(id);
  } catch {
    /* silenzioso */
  }
}

/** Suona `id` (se i suoni sono accesi). Restituisce true se ha provato a suonare. Mai lancia, mai blocca. */
export function play(id: SoundId): boolean {
  try {
    if (!enabled()) return false;
    const t = now();
    const prev = lastPlayed.get(id);
    if (prev !== undefined && t - prev < SOUND_MIN_GAP_MS) return false;
    if (!init()) return false;
    const p = playerFor(id);
    if (!p) return false;
    lastPlayed.set(id, t);
    // Riparte dall'inizio anche se sta ancora suonando.
    void p
      .seekTo(0)
      .catch(() => {})
      .finally(() => {
        try {
          p.play();
        } catch {
          /* silenzioso */
        }
      });
    return true;
  } catch {
    return false;
  }
}

/** Solo per i test. */
export function __resetSoundForTests(clock?: () => number): void {
  players.clear();
  lastPlayed.clear();
  audio = null;
  ready = false;
  now = clock ?? (() => Date.now());
}
