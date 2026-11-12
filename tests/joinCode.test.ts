import { describe, expect, it } from "vitest";

import { CODE_ALPHABET, cleanCodeInput, extractCode, isCompleteCode } from "@/lib/joinCode";

describe("codice d'invito", () => {
  it("l'alfabeto non ha caratteri ambigui e ha 31 simboli", () => {
    expect(CODE_ALPHABET).toHaveLength(31);
    for (const bad of "ILO01") expect(CODE_ALPHABET).not.toContain(bad);
  });
  it("pulisce l'input: maiuscolo, solo simboli validi, massimo 6", () => {
    expect(cleanCodeInput("k7m-2qx")).toBe("K7M2QX");
    expect(cleanCodeInput("abc0o1il9")).toBe("ABC9");
    expect(cleanCodeInput("ABCDEFGHJK")).toBe("ABCDEF");
    expect(cleanCodeInput("   ")).toBe("");
  });
  it("estrae il codice da un testo incollato", () => {
    expect(extractCode("Il nostro codice è K7M2QX, entra!")).toBe("K7M2QX");
    expect(extractCode("k7m 2qx")).toBe("K7M2QX");
    expect(extractCode("niente qui")).toBe("");
  });
  it("completo solo con 6 simboli validi", () => {
    expect(isCompleteCode("K7M2QX")).toBe(true);
    expect(isCompleteCode("K7M2Q")).toBe(false);
    expect(isCompleteCode("K7M2Q0")).toBe(false);
    expect(isCompleteCode("k7m2qx")).toBe(false);
  });
});
