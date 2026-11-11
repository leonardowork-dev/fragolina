// Genera src/lib/userArt.generated.ts: require() statici solo per i file presenti in assets/user-art/.
// Metro richiede require statici, per questo serve questo passo (parte da solo prima di dev/web/preview-shots).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "assets/user-art");
const has = (f) => fs.existsSync(path.join(dir, f));
const req = (f) => (has(f) ? `require("../../assets/user-art/${f}")` : "null");

const stickers = Array.from({ length: 8 }, (_, i) => req(`sticker-${i + 1}.png`));
const out = `// FILE GENERATO da scripts/sync-user-art.mjs — non modificare a mano.
export const userArt = {
  mascot: ${req("mascot-custom.png")} as number | null,
  stickers: [${stickers.join(", ")}] as (number | null)[],
};
`;
fs.writeFileSync(path.join(root, "src/lib/userArt.generated.ts"), out);
console.log("user-art sincronizzata:", has("mascot-custom.png") ? "mascotte " : "", stickers.filter((s) => s !== "null").length + " sticker");
