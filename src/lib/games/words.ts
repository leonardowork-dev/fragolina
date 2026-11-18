/**
 * Confronto delle risposte di "Disegna e indovina": tollera maiuscole, accenti, spazi, articoli iniziali e plurali
 * semplici (gatto/gatti, casa/case, fiore/fiori). Specchio di `_norm_word` / `_same_word` nella migrazione 7.
 */
const ACCENTS: Record<string, string> = {
  à: "a", á: "a", â: "a", ä: "a", è: "e", é: "e", ê: "e", ë: "e", ì: "i", í: "i", î: "i", ï: "i",
  ò: "o", ó: "o", ô: "o", ö: "o", ù: "u", ú: "u", û: "u", ü: "u", ç: "c", ñ: "n",
};

export function normWord(text: string): string {
  let t = text.toLowerCase().replace(/[àáâäèéêëìíîïòóôöùúûüçñ]/g, (c) => ACCENTS[c] ?? c);
  t = t.replace(/[^a-z]+/g, " ").trim().replace(/ +/g, " ");
  t = t.replace(/^(il|lo|la|le|i|gli|l|un|uno|una) (?=.)/, "");
  return t.replace(/ /g, "");
}

export function sameWord(a: string, b: string): boolean {
  const x = normWord(a);
  const y = normWord(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return x.length >= 4 && y.length >= 4 && x.slice(0, -1) === y.slice(0, -1);
}
