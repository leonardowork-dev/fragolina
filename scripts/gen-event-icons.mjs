// Genera targets/widget/EventIcons.swift dai tracciati in src/lib/countdown/icons.json (UNICA fonte dei simboli del conto
// alla rovescia: l'app li disegna con react-native-svg, il widget con SwiftUI). `npm test` controlla che il file sia aggiornato.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function buildSwift() {
  const icons = JSON.parse(fs.readFileSync(path.join(root, "src/lib/countdown/icons.json"), "utf8"));
  const lines = [
    "import Foundation",
    "",
    "// GENERATO da scripts/gen-event-icons.mjs a partire da src/lib/countdown/icons.json: non modificarlo a mano.",
    "// Simboli del conto alla rovescia su una griglia 100×100 (soli comandi M L C Z assoluti). Solo Foundation.",
    "enum EventIconData {",
    "    /// icona → elenco di forme (tracciato, nome del colore della palette o \"none\"), dal fondo verso l'alto.",
    "    static let shapes: [String: [(d: String, fill: String)]] = [",
  ];
  for (const [id, shapes] of Object.entries(icons)) {
    lines.push(`        "${id}": [`);
    for (const sh of shapes) lines.push(`            (d: "${sh.d}", fill: "${sh.fill}"),`);
    lines.push("        ],");
  }
  lines.push("    ]", "}", "");
  return lines.join("\n");
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(path.join(root, "targets/widget/EventIcons.swift"), buildSwift());
  console.log("targets/widget/EventIcons.swift generato");
}
