/**
 * Canale aggiornamenti senza PC: il workflow di build pubblica l'IPA più recente nella release fissa `latest-build`
 * (nome "build N"). L'app guarda il numero, confronta con il proprio e, se è più nuovo, apre SideStore con il link
 * all'IPA (`sidestore://install?url=…`). Funzioni PURE: provate in tests/update.test.ts.
 */
export const UPDATE_API = "https://api.github.com/repos/leonardowork-dev/fragolina/releases/tags/latest-build";
export const UPDATE_CHECK_EVERY_MS = 6 * 3600_000;

export type UpdateInfo = { build: number; url: string; sha: string | null };

/** Legge la risposta dell'API delle release (anche rotta o strana) senza mai lanciare. */
export function parseRelease(j: unknown): UpdateInfo | null {
  if (!j || typeof j !== "object") return null;
  const o = j as { name?: unknown; body?: unknown; assets?: unknown };
  const m = /build\s*(\d+)/i.exec(String(o.name ?? "")) ?? /build=(\d+)/.exec(String(o.body ?? ""));
  const build = m ? Number(m[1]) : NaN;
  const assets = Array.isArray(o.assets) ? (o.assets as { name?: unknown; browser_download_url?: unknown }[]) : [];
  const ipa = assets.find((a) => a?.name === "Fragolina.ipa");
  const url = typeof ipa?.browser_download_url === "string" ? ipa.browser_download_url : "";
  if (!Number.isFinite(build) || build <= 0 || !url.startsWith("https://")) return null;
  const sha = /sha=([0-9a-f]{7})/.exec(String(o.body ?? ""))?.[1] ?? null;
  return { build, url, sha };
}

/** C'è una versione più nuova della mia? (`mine` = 0 o NaN quando il numero non si sa: niente avviso). */
export const isNewer = (info: UpdateInfo | null, mine: number): boolean =>
  !!info && Number.isFinite(mine) && mine > 0 && info.build > mine;

/** Link che apre SideStore sull'installazione dell'IPA. */
export const sideStoreInstallUrl = (ipaUrl: string): string => `sidestore://install?url=${encodeURIComponent(ipaUrl)}`;
/** Ripiego (SideStore deriva da AltStore e risponde anche a questo schema, NON VERIFICATO). */
export const altStoreInstallUrl = (ipaUrl: string): string => `altstore://install?url=${encodeURIComponent(ipaUrl)}`;
