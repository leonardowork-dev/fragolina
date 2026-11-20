import Constants from "expo-constants";

import { S } from "@/lib/strings.it";

/** "Versione 1.0.0 (build 70, abc1234)": serve a capire quale IPA è installata. Parti mancanti: si omettono. */
export function formatVersionLabel(
  version: string,
  build?: string | null,
  sha?: string | null,
): string {
  const extra = [build ? `${S.us.build} ${build}` : "", sha ?? ""].filter(Boolean).join(", ");
  return `${S.us.version} ${version}${extra ? ` (${extra})` : ""}`;
}

export function appVersionLabel(): string {
  const cfg = Constants.expoConfig;
  const extra = (cfg?.extra ?? {}) as { buildNumber?: string; gitSha?: string };
  const build = Constants.platform?.ios?.buildNumber ?? extra.buildNumber ?? "";
  return formatVersionLabel(cfg?.version ?? "1.0.0", build, extra.gitSha);
}
