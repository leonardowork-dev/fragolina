import { S } from "@/lib/strings.it";

/** Prima del collegamento non sappiamo chi è "l'altra persona" (sul telefono di lei sarebbe lui): si dice "la tua persona". */
export const partnerLabel = (paired: boolean, partnerName: string): string =>
  paired ? partnerName : S.pairing.person;

export const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
