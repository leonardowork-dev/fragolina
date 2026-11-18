import type { GameIncoming, GameRejection } from "@/state/coupleStore";
import { S } from "@/lib/strings.it";

/** Il testo dell'avviso in tempo reale per una novità dei giochi portata dall'altra persona. */
export function gameToastText(inc: GameIncoming, partner: string): string {
  const name = S.play.games[inc.kind].name;
  switch (inc.change.type) {
    case "started":
      return S.play.incoming.started(partner, name);
    case "your-turn":
      return S.play.incoming.yourTurn(name);
    case "answered":
      return S.play.incoming.answered(partner);
    case "reveal":
      return S.play.incoming.reveal;
    case "done":
      return S.play.incoming.done(name);
    case "abandoned":
      return S.play.incoming.abandoned(partner);
  }
}

/** Il messaggio gentile quando il server rifiuta una mia mossa (è già tornata indietro da sola). */
export function gameRejectText(rej: GameRejection, partner: string): string {
  switch (rej.error) {
    case "not_your_turn":
      return S.play.rejected.not_your_turn(partner);
    case "game_over":
      return S.play.rejected.game_over;
    case "cell_taken":
      return S.play.rejected.cell_taken;
    case "game_open":
      return S.play.rejected.game_open;
    default:
      return S.play.rejected.other;
  }
}
