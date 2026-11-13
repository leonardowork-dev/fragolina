import type { PetState } from "@/lib/pet/rules";
import { S } from "@/lib/strings.it";
import type { Member } from "@/lib/sync/types";

import type { PetIncoming } from "@/state/createCoupleStore";

/** Il testo del toast quando l'altra persona cura il pet ("Nikole ha dato una mora a Bacca"). Funzione pura. */
export function petToastText(
  inc: PetIncoming,
  members: Member[],
  partnerName: string,
  pet: Pick<PetState, "name"> | null,
): string {
  const who = members.find((m) => m.userId === inc.by)?.displayName ?? partnerName;
  const name = pet?.name ?? S.pet.defaultName;
  switch (inc.kind) {
    case "feed":
      return S.pet.toast.feed(who, inc.item ? S.pet.foodGiven[inc.item] : "un frutto", name);
    case "cuddle":
      return S.pet.toast.cuddle(who, name);
    case "play":
      return S.pet.toast.play(who, name);
    case "sleep":
      return S.pet.toast.sleep(who, name);
    case "hatch":
      return S.pet.toast.hatch(who, name);
    default:
      return S.pet.toast.name(name);
  }
}
