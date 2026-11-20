/**
 * File audio (generati da `npm run sounds:gen`). Un solo posto con i `require`: Metro vuole percorsi letterali.
 * Separato da `sound.ts` perché nei test (Node) non si possono caricare i .wav.
 */
export const SOUND_SOURCES = {
  pop: require("../../assets/sounds/pop.wav"),
  plink: require("../../assets/sounds/plink.wav"),
  paper: require("../../assets/sounds/paper.wav"),
  chew: require("../../assets/sounds/chew.wav"),
  carezza: require("../../assets/sounds/carezza.wav"),
  snore: require("../../assets/sounds/snore.wav"),
  grow: require("../../assets/sounds/grow.wav"),
  fanfara: require("../../assets/sounds/fanfara.wav"),
  tok: require("../../assets/sounds/tok.wav"),
  pareggio: require("../../assets/sounds/pareggio.wav"),
  rivela: require("../../assets/sounds/rivela.wav"),
  scatto: require("../../assets/sounds/scatto.wav"),
  festa: require("../../assets/sounds/festa.wav"),
} as const;

export type SoundId = keyof typeof SOUND_SOURCES;
