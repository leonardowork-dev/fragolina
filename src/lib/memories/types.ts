import type { NoteContent, NoteKind } from "@/lib/note/rules";

/** Un ricordo: una foto (file nello Storage) o un biglietto/disegno "tenuto". */
export type MemoryKind = "photo" | "draw" | "text";
export type MemorySource = "photo" | "note" | "game";

export type Memory = {
  id: string;
  kind: MemoryKind;
  source: MemorySource;
  caption: string;
  /** AAAA-MM-GG */
  day: string;
  /** Percorso nello Storage (`<coppia>/<id>.jpg`), solo per le foto. */
  path: string | null;
  w: number | null;
  h: number | null;
  bytes: number | null;
  content: NoteContent | null;
  /** userId di chi l'ha aggiunto. */
  by: string;
  createdAt: number;
  /** Ancora in coda (non caricata): si vede subito, con l'avviso "in coda". */
  pending?: boolean;
  /** Per una foto in coda: il file locale. */
  localUri?: string;
};

export const CAPTION_MAX = 120;
export const cleanCaption = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, CAPTION_MAX);

/** Stima: il piano gratuito di Supabase ha 1 GB di Storage; una foto ridotta pesa ~300-500 KB. */
export const PHOTO_TARGET_BYTES = 500 * 1024;
export const STORAGE_FREE_BYTES = 1024 * 1024 * 1024;
export const photosThatFit = (avgBytes = 400 * 1024) => Math.floor(STORAGE_FREE_BYTES / avgBytes);

export type KeepKind = Extract<NoteKind, "draw" | "text">;

export function memoryFromJson(x: unknown): Memory | null {
  if (!x || typeof x !== "object") return null;
  const j = x as Record<string, unknown>;
  if (typeof j.id !== "string" || typeof j.day !== "string") return null;
  if (j.kind !== "photo" && j.kind !== "draw" && j.kind !== "text") return null;
  const n = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    id: j.id,
    kind: j.kind,
    source: j.source === "note" || j.source === "game" ? j.source : "photo",
    caption: typeof j.caption === "string" ? j.caption : "",
    day: j.day,
    path: typeof j.path === "string" ? j.path : null,
    w: n(j.w),
    h: n(j.h),
    bytes: n(j.bytes),
    content: j.content && typeof j.content === "object" ? (j.content as NoteContent) : null,
    by: typeof j.by === "string" ? j.by : "",
    createdAt: n(j.createdAt) ?? 0,
  };
}

export const memoriesFromJson = (d: unknown): Memory[] =>
  (Array.isArray(d) ? d : []).map(memoryFromJson).filter((m): m is Memory => m !== null);
