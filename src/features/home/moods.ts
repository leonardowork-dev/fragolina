export const MOOD_IDS = [
  "felice",
  "innamorata",
  "stanca",
  "affamata",
  "stressata",
  "triste",
  "coccole",
  "carica",
] as const;
export type MoodId = (typeof MOOD_IDS)[number];
