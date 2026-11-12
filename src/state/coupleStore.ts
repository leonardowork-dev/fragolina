import { getBackend } from "@/lib/backend";

import { createCoupleStore } from "./createCoupleStore";

export * from "./createCoupleStore";

/** Istanza dell'app: Supabase se ci sono le chiavi, altrimenti la prova locale. */
const instance = createCoupleStore({ backend: getBackend() });
export const useCouple = instance.useCouple;
export const syncEngine = instance.engine;
