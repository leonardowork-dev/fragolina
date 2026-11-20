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
