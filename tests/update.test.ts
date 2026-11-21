import { describe, expect, it } from "vitest";

import { altStoreInstallUrl, isNewer, parseRelease, sideStoreInstallUrl } from "@/lib/update";

const rel = { name: "build 75", body: "build=75 sha=abc1234", assets: [{ name: "source.json", browser_download_url: "https://x/s.json" }, { name: "Fragolina.ipa", browser_download_url: "https://github.com/o/r/releases/download/latest-build/Fragolina.ipa" }] };

describe("canale aggiornamenti", () => {
  it("legge numero, link e commit dalla release", () => {
    expect(parseRelease(rel)).toEqual({ build: 75, url: "https://github.com/o/r/releases/download/latest-build/Fragolina.ipa", sha: "abc1234" });
  });
  it("risposte rotte o senza IPA non danno un aggiornamento (mai lancia)", () => {
    expect(parseRelease(null)).toBeNull();
    expect(parseRelease({ name: "boh" })).toBeNull();
    expect(parseRelease({ ...rel, assets: [] })).toBeNull();
    expect(parseRelease({ ...rel, assets: [{ name: "Fragolina.ipa", browser_download_url: "http://insicuro" }] })).toBeNull();
  });
  it("avvisa solo se è più nuova della mia (e se la mia si sa)", () => {
    const i = parseRelease(rel);
    expect(isNewer(i, 72)).toBe(true);
    expect(isNewer(i, 75)).toBe(false);
    expect(isNewer(i, 80)).toBe(false);
    expect(isNewer(i, 0)).toBe(false);
    expect(isNewer(null, 1)).toBe(false);
  });
  it("link di SideStore con l'indirizzo codificato", () => {
    expect(sideStoreInstallUrl("https://a/b c.ipa")).toBe("sidestore://install?url=https%3A%2F%2Fa%2Fb%20c.ipa");
    expect(altStoreInstallUrl("https://a/b.ipa")).toMatch(/^altstore:\/\/install\?url=/);
  });
});
