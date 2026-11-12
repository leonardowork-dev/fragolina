/** Codice d'invito: 6 caratteri da un alfabeto senza I, L, O, 0, 1 (stesso alfabeto del database). */
export const CODE_LENGTH = 6;
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const VALID = new Set(CODE_ALPHABET.split(""));

/** Mentre si digita: maiuscolo, solo caratteri dell'alfabeto, massimo 6. (O/0/I/1/L non possono esistere nel codice.) */
export function cleanCodeInput(raw: string): string {
  return raw
    .toUpperCase()
    .split("")
    .filter((c) => VALID.has(c))
    .join("")
    .slice(0, CODE_LENGTH);
}

/** Da un testo incollato ("Il nostro codice è K7M-2QX!"): prima cerca un pezzo da sei caratteri validi, poi pulisce. */
export function extractCode(pasted: string): string {
  const tokens = pasted
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const whole = tokens.find((t) => t.length === CODE_LENGTH && [...t].every((c) => VALID.has(c)));
  if (whole) return whole;
  // "K7M 2QX": pezzi staccati che messi insieme fanno esattamente sei simboli validi
  const joined = tokens.join("");
  return joined.length === CODE_LENGTH && [...joined].every((c) => VALID.has(c)) ? joined : "";
}

export const isCompleteCode = (code: string): boolean =>
  code.length === CODE_LENGTH && [...code].every((c) => VALID.has(c));
