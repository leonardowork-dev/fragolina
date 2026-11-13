/** Posizione (arrotondata a ~1 km) e distanza: tipi comuni ad app, backend e widget. */
export type GeoPoint = { latE2: number; lonE2: number; at: number };
/** ok = si vede; hidden = lei/lui ha spento la condivisione; mine_off = io non condivido (quindi non vedo); none = non ancora condivisa. */
export type PartnerLocState = "ok" | "hidden" | "mine_off" | "none";
export type PartnerLoc = {
  name: string;
  state: PartnerLocState;
  latE2: number | null;
  lonE2: number | null;
  at: number | null;
};
export type LocationState = { sharing: boolean; me: GeoPoint | null; partner: PartnerLoc | null };
export const emptyLocation = (): LocationState => ({ sharing: false, me: null, partner: null });
