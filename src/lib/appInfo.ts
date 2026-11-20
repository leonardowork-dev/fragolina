import Constants from "expo-constants";

import { formatVersionLabel } from "@/lib/versionLabel";

export { formatVersionLabel };

export function appVersionLabel(): string {
  const cfg = Constants.expoConfig;
  const extra = (cfg?.extra ?? {}) as { buildNumber?: string; gitSha?: string };
  const build = Constants.platform?.ios?.buildNumber ?? extra.buildNumber ?? "";
  return formatVersionLabel(cfg?.version ?? "1.0.0", build, extra.gitSha);
}
