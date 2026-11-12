// Copia assets/user-art/widget-mascot.png nel catalogo immagini del widget (Assets.xcassets/widget-mascot.imageset),
// così il widget la usa al posto della fragola disegnata. Se il file non c'è, toglie l'imageset (se c'era).
// Chiamato da app.config.js a ogni `expo prebuild` (anche in CI) e provato in tests/widgetArt.test.ts.
const fs = require("fs");
const path = require("path");

const SOURCE = "assets/user-art/widget-mascot.png";
const SET = "targets/widget/Assets.xcassets/widget-mascot.imageset";

/** @returns {"copied" | "removed" | "none" | "toobig"} */
function syncWidgetArt(root) {
  const src = path.join(root, SOURCE);
  const dest = path.join(root, SET);
  if (!fs.existsSync(src)) {
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
      return "removed";
    }
    return "none";
  }
  // Un widget ha poca memoria: oltre 1 MB l'immagine verrebbe scartata dal sistema.
  if (fs.statSync(src).size > 1024 * 1024) return "toobig";
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(src, path.join(dest, "widget-mascot.png"));
  fs.writeFileSync(
    path.join(dest, "Contents.json"),
    JSON.stringify(
      {
        images: [{ idiom: "universal", filename: "widget-mascot.png", scale: "1x" }],
        info: { version: 1, author: "xcode" },
      },
      null,
      2,
    ) + "\n",
  );
  return "copied";
}

module.exports = { syncWidgetArt, SOURCE, SET };
