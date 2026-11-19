import { S } from "@/lib/strings.it";

import { type QaDay, legacyRef, questionText } from "./rules";

/** Le 24 domande della versione base (scelta fra due): servono solo a rileggere le risposte già date. */
const LEGACY = S.questions.map((q) => ({ ref: legacyRef(q.id), text: q.text, a: q.a, b: q.b }));
const byRef = (ref: string) => LEGACY.find((q) => q.ref === ref) ?? null;

export const legacyText = (ref: string): string | null => byRef(ref)?.text ?? null;
/** "Pizza sul divano" per la scelta `a` della domanda `l-sabato`. */
export const legacyChoiceText = (ref: string, choice: "a" | "b"): string => byRef(ref)?.[choice] ?? "";
export const isLegacyRef = (ref: string) => ref.startsWith("l-");

/** Il testo della domanda di un giorno, da qualunque fonte (mazzo, scritta da uno dei due, versione base). */
export const dayQuestion = (d: Pick<QaDay, "ref" | "custom">): string => questionText(d, legacyText);

/** Il testo di una risposta (libera, o la scelta della versione base). */
export const answerText = (d: Pick<QaDay, "ref">, a: { text: string; choice: "a" | "b" | null }): string =>
  a.choice ? legacyChoiceText(d.ref, a.choice) : a.text;
