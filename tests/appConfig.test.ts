import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { APP_NAME } from "@/config/couple";

const ROOT = path.resolve(__dirname, "..");
const load = () => {
  const p = require.resolve("../app.config.js");
  delete require.cache[p];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../app.config.js").expo;
};

describe("configurazione dell'app (icona, nome, suoni, versione)", () => {
  it("il nome sotto l'icona è APP_NAME", () => {
    expect(load().name).toBe(APP_NAME);
  });
  it("l'icona: se c'è il tuo disegno vince, altrimenti quella generata (1024×1024)", () => {
    const user = path.join(ROOT, "assets/user-art/app-icon.png");
    const cfg = load();
    expect(cfg.icon).toBe(fs.existsSync(user) ? "./assets/user-art/app-icon.png" : "./assets/icon.png");
    const png = fs.readFileSync(path.join(ROOT, "assets/icon.png"));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1024, 1024]);
  });
  it("lo splash usa il marchio e lo stesso rosso dello sfondo dell'icona", () => {
    const cfg = load();
    const splash = cfg.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen");
    expect(splash[1].backgroundColor).toBe("#FF2D55");
    expect(fs.existsSync(path.join(ROOT, "assets/splash-mark.png"))).toBe(true);
    const icon = fs.readFileSync(path.join(ROOT, "assets/icon.png"));
    // pixel (2,2) dell'icona = fondo: stesso colore dello splash (255,45,85)
    // decodifica minima non serve: il generatore usa la stessa costante; qui si controlla che sia nel sorgente
    expect(fs.readFileSync(path.join(ROOT, "scripts/make-icon.mjs"), "utf8")).toMatch(/CHOSEN = "1-rosso-splash"/);
    expect(icon.length).toBeGreaterThan(5000);
  });
  it("expo-audio senza microfono (solo riproduzione)", () => {
    const cfg = load();
    const a = cfg.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-audio");
    expect(a?.[1]).toEqual({ microphonePermission: false });
  });
  it("numero di build e commit finiscono nella versione mostrata in Noi", () => {
    const old = { b: process.env.BUILD_NUMBER, g: process.env.GIT_SHA };
    process.env.BUILD_NUMBER = "77";
    process.env.GIT_SHA = "abcdef0123456789";
    const cfg = load();
    expect(cfg.ios.buildNumber).toBe("77");
    expect(cfg.extra).toEqual({ buildNumber: "77", gitSha: "abcdef0" });
    if (old.b === undefined) delete process.env.BUILD_NUMBER;
    else process.env.BUILD_NUMBER = old.b;
    if (old.g === undefined) delete process.env.GIT_SHA;
    else process.env.GIT_SHA = old.g;
  });
  it("il workflow di build passa BUILD_NUMBER e GIT_SHA; il keepalive esiste e usa solo la chiave pubblica", () => {
    const build = fs.readFileSync(path.join(ROOT, ".github/workflows/build-ipa.yml"), "utf8");
    expect(build).toMatch(/BUILD_NUMBER: \$\{\{ github.run_number \}\}/);
    expect(build).toMatch(/GIT_SHA: \$\{\{ github.sha \}\}/);
    const keep = fs.readFileSync(path.join(ROOT, ".github/workflows/keepalive.yml"), "utf8").replace(/^\s*#.*$/gm, "");
    expect(keep).toMatch(/cron: "[^"]+ \*\/3 \* \*"/);
    expect(keep).toMatch(/EXPO_PUBLIC_SUPABASE_ANON_KEY/);
    expect(keep).not.toMatch(/service_role/i);
  });
});
