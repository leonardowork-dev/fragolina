import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { ME_NAME, PARTNER_NAME, RELATIONSHIP_START_DATE } from "@/config/couple";
import type { MoodId } from "@/features/home/moods";
import { safeStorage } from "@/lib/storage";

/**
 * Store della coppia. La FORMA è quella che avrà il dato reale (sessione 2: Supabase).
 * Oggi la sorgente sono dati finti locali; la sessione 2 sostituirà solo le action che scrivono
 * e aggiungerà un sottoscrittore realtime che chiama `applyRemote`.
 */
export type DailyAnswer = "a" | "b";

type CoupleState = {
  meName: string;
  partnerName: string;
  startDate: string; // AAAA-MM-GG
  partnerMood: MoodId;
  partnerMoodAt: number; // ms epoch
  thoughtsSentToday: number;
  thoughtsDay: string; // giorno a cui si riferisce il contatore
  thoughtsReceivedTotal: number;
  lastThoughtAt: number | null;
  question: { id: string; myAnswer: DailyAnswer | null; partnerAnswer: DailyAnswer | null };
  setNames: (me: string, partner: string) => void;
  setStartDate: (iso: string) => void;
  setPartnerMood: (mood: MoodId) => void;
  sendThought: () => void;
  answerQuestion: (a: DailyAnswer) => void;
  /** Punto d'ingresso per il realtime (sessione 2). Oggi non usato. */
  applyRemote: (patch: Partial<Pick<CoupleState, "partnerMood" | "partnerMoodAt" | "thoughtsReceivedTotal">>) => void;
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export const useCouple = create<CoupleState>()(
  persist(
    (set, get) => ({
      meName: ME_NAME,
      partnerName: PARTNER_NAME,
      startDate: RELATIONSHIP_START_DATE,
      partnerMood: "innamorata",
      partnerMoodAt: Date.now(),
      thoughtsSentToday: 2,
      thoughtsDay: todayKey(),
      thoughtsReceivedTotal: 41,
      lastThoughtAt: null,
      question: { id: "q-sabato", myAnswer: null, partnerAnswer: "a" },
      setNames: (meName, partnerName) => set({ meName, partnerName }),
      setStartDate: (startDate) => set({ startDate }),
      setPartnerMood: (partnerMood) => set({ partnerMood, partnerMoodAt: Date.now() }),
      sendThought: () => {
        const key = todayKey();
        const s = get();
        const base = s.thoughtsDay === key ? s.thoughtsSentToday : 0;
        set({ thoughtsSentToday: base + 1, thoughtsDay: key, lastThoughtAt: Date.now() });
      },
      answerQuestion: (a) => set((s) => ({ question: { ...s.question, myAnswer: a } })),
      applyRemote: (patch) => set(patch),
    }),
    {
      name: "fragolina.couple.v1",
      storage: createJSONStorage(() => safeStorage),
    },
  ),
);

/** Contatore "oggi" che si azzera da solo al cambio giorno. */
export function selectThoughtsToday(s: CoupleState): number {
  return s.thoughtsDay === todayKey() ? s.thoughtsSentToday : 0;
}
