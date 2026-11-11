// Copia canvaskit.wasm (motore Skia per il browser) in public/ se manca. Solo per l'anteprima web.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, "public", "canvaskit.wasm");
const candidates = [
  "node_modules/canvaskit-wasm/bin/full/canvaskit.wasm",
  "node_modules/canvaskit-wasm/bin/canvaskit.wasm",
  "node_modules/@shopify/react-native-skia/node_modules/canvaskit-wasm/bin/full/canvaskit.wasm",
];
if (!fs.existsSync(dest)) {
  const src = candidates.map((c) => path.join(root, c)).find((c) => fs.existsSync(c));
  if (src) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log("canvaskit.wasm copiato in public/");
  } else {
    console.warn("canvaskit.wasm non trovato: la tela Disegna sul web non partirà (sul telefono funziona).");
  }
}
