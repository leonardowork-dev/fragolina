import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { syncWidgetArt, SOURCE, SET } = require("../scripts/widget-art.js");

function tmpRoot() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "frag-art-"));
  fs.mkdirSync(path.join(r, "assets/user-art"), { recursive: true });
  fs.mkdirSync(path.join(r, "targets/widget/Assets.xcassets"), { recursive: true });
  return r;
}

describe("slot dell'artwork per il widget", () => {
  it("senza file: non fa nulla", () => {
    const r = tmpRoot();
    expect(syncWidgetArt(r)).toBe("none");
    expect(fs.existsSync(path.join(r, SET))).toBe(false);
  });
  it("con widget-mascot.png: crea l'imageset con Contents.json valido", () => {
    const r = tmpRoot();
    fs.writeFileSync(path.join(r, SOURCE), Buffer.from([137, 80, 78, 71]));
    expect(syncWidgetArt(r)).toBe("copied");
    const c = JSON.parse(fs.readFileSync(path.join(r, SET, "Contents.json"), "utf8"));
    expect(c.images[0].filename).toBe("widget-mascot.png");
    expect(fs.existsSync(path.join(r, SET, "widget-mascot.png"))).toBe(true);
  });
  it("se il file sparisce, toglie l'imageset", () => {
    const r = tmpRoot();
    fs.writeFileSync(path.join(r, SOURCE), Buffer.from([1]));
    syncWidgetArt(r);
    fs.rmSync(path.join(r, SOURCE));
    expect(syncWidgetArt(r)).toBe("removed");
    expect(fs.existsSync(path.join(r, SET))).toBe(false);
  });
  it("oltre 1 MB non lo copia (il widget ha poca memoria)", () => {
    const r = tmpRoot();
    fs.writeFileSync(path.join(r, SOURCE), Buffer.alloc(1024 * 1024 + 1));
    expect(syncWidgetArt(r)).toBe("toobig");
  });
});
