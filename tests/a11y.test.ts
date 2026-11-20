import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Accessibilità, controllo statico: ogni controllo che si tocca (Pressable, StickerPressable, Sticker con onPress,
 * TextInput…) deve avere `accessibilityLabel` (o ereditarlo con uno spread di props) e un ruolo (le primitive danno
 * `button` di base; i controlli RN grezzi devono dichiararlo). Un controllo senza etichetta per VoiceOver è un bug.
 */
const ROOT = path.resolve(__dirname, "..");

function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) files(f, out);
    else if (/\.tsx$/.test(e.name)) out.push(f);
  }
  return out;
}

/** Toglie i commenti (le doc dei componenti citano `<Sticker onPress=…>` come esempio). */
const noComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/^\s*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));

/** Tutti i tag JSX di apertura con nome dato, col testo delle loro props (rispettando { } e stringhe). */
function tags(src: string, names: string[]): { name: string; props: string; line: number }[] {
  const out: { name: string; props: string; line: number }[] = [];
  const re = new RegExp(`<(${names.join("|")})(?=[\\s/>])`, "g");
  for (const m of src.matchAll(re)) {
    let i = m.index! + m[0].length;
    let depth = 0;
    let q: string | null = null;
    const start = i;
    for (; i < src.length; i++) {
      const c = src[i]!;
      if (q) {
        if (c === q && src[i - 1] !== "\\") q = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") q = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && src[i - 1] !== "=") break;
    }
    out.push({ name: m[1]!, props: src.slice(start, i), line: src.slice(0, m.index).split("\n").length });
  }
  return out;
}

const interactive = ["Pressable", "RNPressable", "StickerPressable", "TouchableOpacity", "TextInput", "Switch"];
const all = [...files(path.join(ROOT, "src")), ...files(path.join(ROOT, "app"))];

describe("accessibilità: etichette e ruoli", () => {
  it("ogni controllo toccabile ha accessibilityLabel (o eredita le props)", () => {
    const missing: string[] = [];
    for (const f of all) {
      const src = noComments(fs.readFileSync(f, "utf8"));
      for (const t of tags(src, interactive)) {
        if (/accessibilityLabel|accessible=\{false\}/.test(t.props) || /\{\.\.\.\w+/.test(t.props)) continue;
        missing.push(`${path.relative(ROOT, f)}:${t.line} <${t.name}>`);
      }
    }
    expect(missing, `controlli senza accessibilityLabel:\n${missing.join("\n")}`).toEqual([]);
  });

  it("ogni Sticker con onPress ha accessibilityLabel (è un bottone)", () => {
    const missing: string[] = [];
    for (const f of all) {
      const src = noComments(fs.readFileSync(f, "utf8"));
      for (const t of tags(src, ["Sticker"])) {
        if (!/\bonPress\b/.test(t.props)) continue;
        if (/accessibilityLabel/.test(t.props) || /\{\.\.\.\w+/.test(t.props)) continue;
        missing.push(`${path.relative(ROOT, f)}:${t.line} <Sticker onPress>`);
      }
    }
    expect(missing, `Sticker toccabili senza accessibilityLabel:\n${missing.join("\n")}`).toEqual([]);
  });

  it("i controlli RN grezzi dichiarano il ruolo", () => {
    const missing: string[] = [];
    for (const f of all) {
      if (/design[\\/]primitives[\\/]Pressable\.tsx$/.test(f)) continue; // StickerPressable dà `button` di base
      const src = noComments(fs.readFileSync(f, "utf8"));
      for (const t of tags(src, ["Pressable", "RNPressable", "TouchableOpacity"])) {
        if (/accessibilityRole|\{\.\.\.\w+/.test(t.props)) continue;
        missing.push(`${path.relative(ROOT, f)}:${t.line} <${t.name}>`);
      }
    }
    expect(missing, `controlli senza accessibilityRole:\n${missing.join("\n")}`).toEqual([]);
  });

  it("le immagini informative hanno una descrizione (o sono nascoste)", () => {
    const missing: string[] = [];
    for (const f of all) {
      const src = noComments(fs.readFileSync(f, "utf8"));
      for (const t of tags(src, ["Image"])) {
        if (/accessibilityLabel|accessibilityElementsHidden|importantForAccessibility|accessible=\{false\}/.test(t.props) || /\{\.\.\.\w+/.test(t.props)) continue;
        missing.push(`${path.relative(ROOT, f)}:${t.line} <Image>`);
      }
    }
    expect(missing, `immagini senza descrizione:\n${missing.join("\n")}`).toEqual([]);
  });

  it("nessuna etichetta è vuota e i target minimi (minHeight/hitSlop) non sono sotto i 44 pt nei bottoni principali", () => {
    const tooSmall: string[] = [];
    for (const f of all) {
      const src = noComments(fs.readFileSync(f, "utf8"));
      for (const m of src.matchAll(/accessibilityLabel=(?:""|\{""\}|\{''\})/g)) tooSmall.push(`${path.relative(ROOT, f)} etichetta vuota @${m.index}`);
    }
    // Button e Sticker-bottone: l'altezza minima nel codice è ≥ 48 (vedi Button.tsx)
    const btn = fs.readFileSync(path.join(ROOT, "src/design/primitives/Button.tsx"), "utf8");
    expect(btn).toMatch(/minHeight: 52/);
    expect(btn).toMatch(/minHeight: 48/);
    expect(tooSmall).toEqual([]);
  });
});
