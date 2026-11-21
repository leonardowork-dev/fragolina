// Scrive out/source.json (sorgente SideStore/AltStore) per la release `latest-build`.
// Uso (workflow): node scripts/publish-update-source.mjs <ipa> <repo> <build> <sha> [version]
import fs from "node:fs";
import path from "node:path";

const [ipa, repo, build, sha, versionArg] = process.argv.slice(2);
if (!ipa || !repo || !build) {
  console.error("uso: publish-update-source.mjs <ipa> <repo> <build> <sha> [version]");
  process.exit(2);
}
const size = fs.statSync(ipa).size;
let version = versionArg;
if (!version) {
  try {
    version = (await import("node:module")).createRequire(import.meta.url)("../app.config.js").expo.version;
  } catch {
    version = "1.0.0";
  }
}
const date = new Date().toISOString().replace(/\.\d+Z$/, "Z");
const url = `https://github.com/${repo}/releases/download/latest-build/Fragolina.ipa`;
const app = {
  name: "Fragolina",
  bundleIdentifier: "app.fragolina.couple",
  developerName: "Fragolina",
  subtitle: "Solo per noi due",
  localizedDescription: "App privata di coppia.",
  version,
  versionDate: date,
  downloadURL: url,
  size,
  versions: [{ version, buildVersion: String(build), date, downloadURL: url, size, localizedDescription: `build ${build} (${sha || "?"})` }],
};
const out = path.join(path.dirname(ipa), "source.json");
fs.writeFileSync(out, JSON.stringify({ name: "Fragolina", identifier: "app.fragolina.source", apps: [app], news: [] }, null, 2));
console.log(out);
