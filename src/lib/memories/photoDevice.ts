import { PHOTO_TARGET_BYTES } from "./types";

/**
 * Foto sul telefono: scelta dal rullino (selettore di sistema), ridotta (lato lungo ~1600 px) e compressa (JPEG ~80%, sotto
 * 500 KB) PRIMA di uscire dal telefono, poi copiata in una cartella nostra (la cache può essere svuotata dal sistema:
 * una foto in coda offline deve restare). Solo qui si toccano i moduli nativi (expo-image-picker, -manipulator, file-system).
 */
// Non importa `react-native` (così lo store si prova anche senza telefono): il browser ha `document`, il telefono no.
const isWeb = typeof document !== "undefined";
export const LONG_SIDE = 1600;
export type PreparedPhoto = { uri: string; w: number; h: number; bytes: number };
export type PickResult = { ok: true; photo: PreparedPhoto } | { ok: false; reason: "cancelled" | "failed" };

const dataUriBytes = (u: string) => {
  const i = u.indexOf("base64,");
  const b64 = i >= 0 ? u.slice(i + 7) : "";
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
};

async function sizeOf(uri: string): Promise<number> {
  if (uri.startsWith("data:")) return dataUriBytes(uri);
  const { File } = await import("expo-file-system");
  return new File(uri).size ?? 0;
}

/** Ridimensiona e comprime una foto già scelta. Provato con quality 0.8, poi scende finché sta sotto il tetto. */
export async function shrink(uri: string, w: number, h: number): Promise<PreparedPhoto> {
  const M = await import("expo-image-manipulator");
  const long = Math.max(w, h);
  const scale = long > LONG_SIDE ? LONG_SIDE / long : 1;
  let width = Math.max(1, Math.round(w * scale));
  let height = Math.max(1, Math.round(h * scale));
  let quality = 0.8;
  for (let i = 0; i < 6; i++) {
    const r = await M.manipulateAsync(uri, scale < 1 || i > 0 ? [{ resize: { width, height } }] : [], {
      compress: quality,
      format: M.SaveFormat.JPEG,
    });
    const bytes = await sizeOf(r.uri);
    if (bytes <= PHOTO_TARGET_BYTES || i === 5) return { uri: r.uri, w: r.width, h: r.height, bytes };
    quality = Math.max(0.4, quality - 0.1);
    if (i >= 2) {
      width = Math.round(width * 0.85);
      height = Math.round(height * 0.85);
    }
  }
  throw new Error("shrink");
}

export async function pickPhoto(): Promise<PickResult> {
  try {
    const P = await import("expo-image-picker");
    const res = await P.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 1,
      exif: false,
    });
    const a = res.canceled ? null : res.assets[0];
    if (!a) return { ok: false, reason: "cancelled" };
    return { ok: true, photo: await shrink(a.uri, a.width, a.height) };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Copia il file in una cartella che il sistema non svuota (solo sul telefono; nel browser l'indirizzo `data:` resta com'è). */
export async function persistPhoto(uri: string, id: string): Promise<string> {
  if (isWeb || uri.startsWith("data:")) return uri;
  const { Directory, File, Paths } = await import("expo-file-system");
  const dir = new Directory(Paths.document, "memories-pending");
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${id}.jpg`);
  if (dest.exists) dest.delete();
  new File(uri).copy(dest);
  return dest.uri;
}

/** Toglie il file locale (dopo il caricamento o se la foto è stata annullata). Mai un errore. */
export async function discardPhoto(uri: string | undefined | null): Promise<void> {
  if (!uri || uri.startsWith("data:") || isWeb) return;
  try {
    const { File } = await import("expo-file-system");
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* niente */
  }
}

export async function readPhotoBytes(uri: string): Promise<ArrayBuffer> {
  if (uri.startsWith("data:") || isWeb) return (await fetch(uri)).arrayBuffer();
  const { File } = await import("expo-file-system");
  return new File(uri).arrayBuffer();
}
