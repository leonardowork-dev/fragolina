import { Platform } from "react-native";

/**
 * Archivio della sessione Supabase. Su iPhone: portachiavi (expo-secure-store), a pezzi da 1800 caratteri per
 * non sforare il limite consigliato di 2048 byte per valore. Sul web (solo anteprima): localStorage.
 */
const CHUNK = 1800;

type SecureStoreModule = typeof import("expo-secure-store");
let ss: SecureStoreModule | null = null;
function store(): SecureStoreModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- caricamento pigro: solo la piattaforma/backend che serve
  if (!ss) ss = require("expo-secure-store") as SecureStoreModule;
  return ss;
}
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, "_");

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    const k = safeKey(key);
    const head = await store().getItemAsync(k);
    if (head === null) return null;
    const m = /^__chunks:(\d+)$/.exec(head);
    if (!m) return head;
    let out = "";
    for (let i = 0; i < Number(m[1]); i++) {
      const part = await store().getItemAsync(`${k}.${i}`);
      if (part === null) return null; // pezzo mancante: sessione illeggibile, meglio ripartire
      out += part;
    }
    return out;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* niente */
      }
      return;
    }
    const k = safeKey(key);
    if (value.length <= CHUNK) {
      await store().setItemAsync(k, value);
      return;
    }
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++)
      await store().setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await store().setItemAsync(k, `__chunks:${n}`);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        localStorage.removeItem(key);
      } catch {
        /* niente */
      }
      return;
    }
    const k = safeKey(key);
    const head = await store().getItemAsync(k);
    const m = head ? /^__chunks:(\d+)$/.exec(head) : null;
    if (m) for (let i = 0; i < Number(m[1]); i++) await store().deleteItemAsync(`${k}.${i}`);
    await store().deleteItemAsync(k);
  },
};
