import { create } from "zustand";

import type { PartnerExpiry } from "@/lib/backend/types";

/**
 * Scadenza dell'app (Apple ID gratuito: 7 giorni). NON persistito: si rilegge dal profilo a ogni avvio e a ogni
 * ritorno in primo piano, così dopo un rinnovo la data nuova è subito quella vera.
 */
type ExpiryStore = {
  /** La MIA scadenza (ms), dal provisioning profile. `null` = non si legge (web, build non sideload). */
  mine: number | null;
  /** Quella dell'altra persona, come l'ha scritta lei sul server. */
  partner: PartnerExpiry | null;
  /** Quando è stata letta la scadenza (ms): è il "adesso" dei calcoli a schermo (si aggiorna a ogni ritorno in primo piano). */
  readAt: number;
  setMine: (ms: number | null) => void;
  setPartner: (p: PartnerExpiry | null) => void;
};

export const useExpiry = create<ExpiryStore>((set) => ({
  mine: null,
  partner: null,
  readAt: 0,
  setMine: (mine) => set({ mine, readAt: Date.now() }),
  setPartner: (partner) => set({ partner }),
}));
