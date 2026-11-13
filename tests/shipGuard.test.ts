import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// Percorso in variabile: tsc non cerca i tipi di un file .mjs.
const GUARD = "../scripts/lib/ship-guard.mjs";
let g: any;
beforeAll(async () => {
  g = await import(/* @vite-ignore */ GUARD);
});

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ship-")), ".ship.lock");

describe("ship: lavoro non salvato", () => {
  it("elenca i file modificati e ignora il lock", () => {
    const f = g.dirtyFiles(" M src/a.ts\n?? new.txt\n D old.ts\n?? .ship.lock\n");
    expect(f.map((x: { file: string }) => x.file)).toEqual(["src/a.ts", "new.txt", "old.ts"]);
  });
  it("regge l'output di git senza lo spazio iniziale (trim)", () => {
    expect(g.dirtyFiles("M .gitignore\n?? a b.txt").map((x: { file: string }) => x.file)).toEqual([".gitignore", "a b.txt"]);
  });
  it("albero pulito = nessun file", () => {
    expect(g.dirtyFiles("")).toEqual([]);
  });
  it("il messaggio spiega cosa fare in italiano", () => {
    const m = g.dirtyMessage(g.dirtyFiles(" M src/a.ts\n"));
    expect(m).toContain("src/a.ts");
    expect(m).toContain("fai commit di tutto");
  });
  it("--commit va chiesto in modo esplicito", () => {
    expect(g.parseArgs(["release"])).toEqual({ mode: "release", commit: false });
    expect(g.parseArgs(["release", "--commit"])).toEqual({ mode: "release", commit: true });
    expect(g.parseArgs(["dev"])).toEqual({ mode: "dev-client", commit: false });
    expect(g.parseArgs([])).toEqual({ mode: "release", commit: false });
  });
});

describe("ship: push", () => {
  it("HEAD già su origin → niente push", () => {
    expect(g.pushDecision("aaa", "aaa", true)).toBe("skip");
  });
  it("origin più avanti → si ferma", () => {
    expect(g.pushDecision("aaa", "bbb", true)).toBe("behind");
  });
  it("commit nuovo → push", () => {
    expect(g.pushDecision("aaa", "bbb", false)).toBe("push");
    expect(g.pushDecision("aaa", "", false)).toBe("push");
  });
});

describe("ship: lock", () => {
  it("la seconda catena si rifiuta e dice chi è attiva", () => {
    const f = tmp();
    expect(g.acquireLock(f, { pid: 111, mode: "release", sha: "abc" }, () => true).ok).toBe(true);
    const r = g.acquireLock(f, { pid: 222, mode: "dev-client", sha: null }, () => true);
    expect(r.ok).toBe(false);
    expect(r.holder.pid).toBe(111);
    expect(r.holder.mode).toBe("release");
  });
  it("un lock di un processo morto si libera da solo", () => {
    const f = tmp();
    g.acquireLock(f, { pid: 111, mode: "release", sha: null }, () => true);
    const r = g.acquireLock(f, { pid: 222, mode: "release", sha: null }, () => false);
    expect(r.ok).toBe(true);
    expect(g.readLock(f).pid).toBe(222);
  });
  it("un lock illeggibile viene tolto", () => {
    const f = tmp();
    fs.writeFileSync(f, "{rotto");
    expect(g.acquireLock(f, { pid: 5, mode: "release", sha: null }).ok).toBe(true);
  });
  it("release toglie solo il lock proprio; update aggiunge lo SHA", () => {
    const f = tmp();
    g.acquireLock(f, { pid: 111, mode: "release", sha: null });
    g.releaseLock(f, 999);
    expect(fs.existsSync(f)).toBe(true);
    g.updateLock(f, 111, { sha: "def" });
    expect(g.readLock(f).sha).toBe("def");
    g.releaseLock(f, 111);
    expect(fs.existsSync(f)).toBe(false);
  });
  it("pidAlive: io esisto, un PID enorme no", () => {
    expect(g.pidAlive(process.pid)).toBe(true);
    expect(g.pidAlive(2 ** 22 + 12345)).toBe(false);
    expect(g.pidAlive(0)).toBe(false);
  });
  it("race vera: due processi, uno solo vince", async () => {
    const f = tmp();
    const abs = path.resolve(__dirname, "../scripts/lib/ship-guard.mjs");
    const code = `import {acquireLock} from ${JSON.stringify("file://" + abs)}; const r=acquireLock(${JSON.stringify(f)},{pid:process.pid,mode:"x",sha:null}); console.log(r.ok?"WIN":"LOSE"); if(r.ok) setTimeout(()=>{},1500);`;
    const run = () =>
      new Promise<string>((res) => {
        const c = spawn(process.execPath, ["--input-type=module", "-e", code]);
        let out = "";
        c.stdout.on("data", (d) => (out += d));
        c.on("close", () => res(out.trim()));
      });
    const [a, b] = await Promise.all([run(), run()]);
    expect([a, b].sort()).toEqual(["LOSE", "WIN"]);
  });
});
