import { describe, expect, it } from "vitest";

import {
  type LinkDeps,
  createLinkGate,
  parseDeepLink,
  runDeepLink,
  systemPathFor,
} from "@/lib/deepLink";

describe("parser dei link dei widget", () => {
  it("riconosce i quattro link", () => {
    expect(parseDeepLink("fragolina://ping")).toBe("ping");
    expect(parseDeepLink("fragolina://mood")).toBe("mood");
    expect(parseDeepLink("fragolina://us")).toBe("us");
    expect(parseDeepLink("fragolina://home")).toBe("home");
    expect(parseDeepLink("fragolina://pet")).toBe("pet");
    expect(parseDeepLink("fragolina://pet/")).toBe("pet");
    expect(parseDeepLink("fragolina:///pet?x=1")).toBe("pet");
  });
  it("tollera maiuscole, slash finale, tre slash, query e spazi", () => {
    expect(parseDeepLink("Fragolina://PING")).toBe("ping");
    expect(parseDeepLink("fragolina://ping/")).toBe("ping");
    expect(parseDeepLink("fragolina:///ping")).toBe("ping");
    expect(parseDeepLink("fragolina://ping?da=widget")).toBe("ping");
    expect(parseDeepLink("fragolina://mood#x")).toBe("mood");
    expect(parseDeepLink("  fragolina://us ")).toBe("us");
  });
  it("tutto il resto è none (niente azioni a caso)", () => {
    for (const u of [
      "",
      null,
      undefined,
      "fragolina://",
      "fragolina://pingg",
      "fragolina://ping/extra",
      "fragolina://cancella",
      "https://ping",
      "ping",
      "/ping",
      "otherapp://ping",
      "fragolina:ping",
    ])
      expect(parseDeepLink(u as string), String(u)).toBe("none");
  });
  it("percorsi di sistema per il router", () => {
    expect(systemPathFor("fragolina://ping")).toBe("/");
    expect(systemPathFor("fragolina://mood")).toBe("/");
    expect(systemPathFor("fragolina://home")).toBe("/");
    expect(systemPathFor("fragolina://us")).toBe("/us");
    expect(systemPathFor("fragolina://pet")).toBe("/pet");
    expect(systemPathFor("fragolina://boh")).toBeNull();
    expect(systemPathFor("https://esempio.it")).toBeNull();
  });
});

function deps(over: Partial<LinkDeps> = {}) {
  const calls: string[] = [];
  const d: LinkDeps = {
    paired: true,
    sendThought: () => (calls.push("send"), true),
    goTo: (p) => calls.push(`go:${p}`),
    requestMoodSheet: () => calls.push("mood"),
    confirmPing: () => calls.push("confirm"),
    ...over,
  };
  return { d, calls };
}

describe("esecuzione dei link", () => {
  it("ping da collegati: va in Home, manda UN pensiero, conferma", () => {
    const { d, calls } = deps();
    expect(runDeepLink("ping", d)).toBe("sent");
    expect(calls).toEqual(["go:/", "send", "confirm"]);
  });
  it("ping da NON collegati: porta a Noi e non manda nulla", () => {
    const { d, calls } = deps({ paired: false });
    expect(runDeepLink("ping", d)).toBe("to-us");
    expect(calls).toEqual(["go:/us"]);
  });
  it("ping rifiutato dallo store: nessuna conferma finta", () => {
    const calls2: string[] = [];
    const { d, calls } = deps({ sendThought: () => (calls2.push("send"), false) });
    expect(runDeepLink("ping", d)).toBe("ignored");
    expect(calls).toEqual(["go:/"]); // va in Home, ma senza conferma né avviso
    expect(calls2).toEqual(["send"]);
  });
  it("mood: apre la scelta (collegati) o porta a Noi (non collegati)", () => {
    const a = deps();
    expect(runDeepLink("mood", a.d)).toBe("mood");
    expect(a.calls).toEqual(["go:/", "mood"]);
    const b = deps({ paired: false });
    expect(runDeepLink("mood", b.d)).toBe("to-us");
    expect(b.calls).toEqual(["go:/us"]);
  });
  it("us e home vanno al posto giusto; none non fa nulla", () => {
    const a = deps();
    expect(runDeepLink("us", a.d)).toBe("to-us");
    expect(runDeepLink("home", a.d)).toBe("to-home");
    expect(a.calls).toEqual(["go:/us", "go:/"]);
    const b = deps();
    expect(runDeepLink("none", b.d)).toBe("ignored");
    expect(b.calls).toEqual([]);
  });
});

describe("cancello di idempotenza (un tocco = un pensiero)", () => {
  it("lo stesso link due volte in 4 s vale una volta", () => {
    const g = createLinkGate(4000);
    expect(g.accept("fragolina://ping", 1000)).toBe(true);
    expect(g.accept("fragolina://ping", 1500)).toBe(false);
    expect(g.accept("fragolina://ping", 4999)).toBe(false);
  });
  it("dopo la finestra, un secondo tocco vero passa", () => {
    const g = createLinkGate(4000);
    expect(g.accept("fragolina://ping", 0)).toBe(true);
    expect(g.accept("fragolina://ping", 5000)).toBe(true);
  });
  it("link diversi non si bloccano a vicenda", () => {
    const g = createLinkGate(4000);
    expect(g.accept("fragolina://ping", 0)).toBe(true);
    expect(g.accept("fragolina://mood", 100)).toBe(true);
  });
  it("l'URL iniziale vale una sola volta per esecuzione, anche a finestra scaduta", () => {
    const g = createLinkGate(4000);
    expect(g.accept("fragolina://ping", 0, true)).toBe(true);
    expect(g.accept("fragolina://ping", 60_000, true)).toBe(false);
    // ma un tocco nuovo (evento, non iniziale) passa
    expect(g.accept("fragolina://ping", 60_000)).toBe(true);
  });
  it("app avviata a freddo dal widget: iniziale + evento duplicato = un solo pensiero", () => {
    const g = createLinkGate(4000);
    let sent = 0;
    for (const [initial, t] of [[true, 0], [false, 300]] as const)
      if (g.accept("fragolina://ping", t, initial)) sent++;
    expect(sent).toBe(1);
  });
});

describe("link del Pet (sessione 4)", () => {
  it("fragolina://pet apre il Pet, collegati o no, e non fa altro", () => {
    for (const paired of [true, false]) {
      const calls: string[] = [];
      const out = runDeepLink("pet", {
        paired,
        sendThought: () => (calls.push("send"), true),
        goTo: (p) => calls.push(`go:${p}`),
        requestMoodSheet: () => calls.push("mood"),
        confirmPing: () => calls.push("confirm"),
      });
      expect(out).toBe("to-pet");
      expect(calls).toEqual(["go:/pet"]);
    }
  });
  it("idempotente: lo stesso link due volte entro 4 s vale una volta, l'URL iniziale una volta per esecuzione", () => {
    const g = createLinkGate();
    expect(g.accept("fragolina://pet", 1000, true)).toBe(true);
    expect(g.accept("fragolina://pet", 1500, false)).toBe(false);
    expect(g.accept("fragolina://pet", 1600, true)).toBe(false);
    expect(g.accept("fragolina://pet", 6000, false)).toBe(true);
  });
});

describe("link del biglietto (sessione 5)", () => {
  it("fragolina://draw si legge in tutte le forme e porta alla scheda Disegna", () => {
    expect(parseDeepLink("fragolina://draw")).toBe("draw");
    expect(parseDeepLink("fragolina://draw/")).toBe("draw");
    expect(parseDeepLink("fragolina:///draw?x=1")).toBe("draw");
    expect(parseDeepLink("fragolina://DRAW")).toBe("draw");
    expect(systemPathFor("fragolina://draw")).toBe("/draw");
  });
  it("apre Disegna, collegati o no, e non manda nessun pensiero", () => {
    for (const paired of [true, false]) {
      const calls: string[] = [];
      const out = runDeepLink("draw", {
        paired,
        sendThought: () => (calls.push("send"), true),
        goTo: (p) => calls.push(`go:${p}`),
        requestMoodSheet: () => calls.push("mood"),
        confirmPing: () => calls.push("confirm"),
      });
      expect(out).toBe("to-draw");
      expect(calls).toEqual(["go:/draw"]);
    }
  });
  it("idempotente come gli altri (stesso link due volte entro 4 s = una)", () => {
    const g = createLinkGate();
    expect(g.accept("fragolina://draw", 1000, false)).toBe(true);
    expect(g.accept("fragolina://draw", 2000, false)).toBe(false);
  });
});

describe("link dei giochi (sessione 6)", () => {
  it("fragolina://play e play/<gioco> si leggono in tutte le forme", () => {
    expect(parseDeepLink("fragolina://play")).toBe("play");
    expect(parseDeepLink("fragolina://play/")).toBe("play");
    expect(parseDeepLink("fragolina:///PLAY?x=1")).toBe("play");
    expect(parseDeepLink("fragolina://play/tris")).toBe("play-tris");
    expect(parseDeepLink("fragolina://play/quiz/")).toBe("play-quiz");
    expect(parseDeepLink("fragolina://play/draw?ref=w")).toBe("play-draw");
    expect(parseDeepLink("fragolina://play/boh")).toBe("play"); // gioco sconosciuto: solo la scheda
    expect(parseDeepLink("fragolina://ping/tris")).toBe("none"); // gli altri link non hanno sottopercorsi
    expect(parseDeepLink("fragolina://play/tris/altro")).toBe("none");
  });
  it("percorso di sistema: la scheda Gioca", () => {
    for (const u of ["play", "play/tris", "play/quiz", "play/draw"]) expect(systemPathFor(`fragolina://${u}`)).toBe("/play");
  });
  it("apre Gioca (e il gioco), collegati o no, senza mandare pensieri", () => {
    for (const paired of [true, false])
      for (const [link, kind] of [["play", null], ["play-tris", "tris"], ["play-quiz", "quiz"], ["play-draw", "draw"]] as const) {
        const calls: string[] = [];
        const out = runDeepLink(link, {
          paired,
          sendThought: () => (calls.push("send"), true),
          goTo: (p) => calls.push(`go:${p}`),
          openGame: (k) => calls.push(`game:${k}`),
          requestMoodSheet: () => calls.push("mood"),
          confirmPing: () => calls.push("confirm"),
        });
        expect(out).toBe("to-play");
        expect(calls).toEqual(["go:/play", `game:${kind}`]);
      }
  });
  it("idempotente come gli altri", () => {
    const g = createLinkGate();
    expect(g.accept("fragolina://play/tris", 1000, false)).toBe(true);
    expect(g.accept("fragolina://play/tris", 2000, false)).toBe(false);
    expect(g.accept("fragolina://play/quiz", 2100, false)).toBe(true);
  });
});
