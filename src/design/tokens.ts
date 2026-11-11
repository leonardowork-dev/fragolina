/**
 * Token del design system "Sticker Book".
 * Colori (chiaro + scuro predisposto), spaziatura (base 4/8), raggi, contorni, ombre dure,
 * scala tipografica e token di movimento. Nessun gradiente, nessun blur, nessun viola.
 */
import { Easing } from "react-native-reanimated";

export const palette = {
  ink: "#22121F",
  paper: "#FFF4F6",
  strawberry: "#FF2D55",
  strawberryDeep: "#C4143A",
  leaf: "#2FBF71",
  sky: "#8FD3FF",
  butter: "#FFD84D",
  blush: "#FFC2CF",
  white: "#FFFFFF",
  // Tinte: gradini piatti, mai sfumature.
  blushSoft: "#FFE3EA",
  skySoft: "#D9F0FF",
  butterSoft: "#FFF0B3",
  leafSoft: "#C9F0DA",
  strawberrySoft: "#FFB3C1",
} as const;

export type ColorTokens = {
  ink: string; // testo e contorni
  ground: string; // fondo pagina
  surface: string; // fondo adesivo "carta"
  accent: string; // fragola
  accentText: string; // testo sull'accento (sempre inchiostro: 4.90:1)
  accentInk: string; // accento usato come testo piccolo su fondo
  leaf: string;
  sky: string;
  butter: string;
  blush: string;
  blushSoft: string;
  skySoft: string;
  butterSoft: string;
  leafSoft: string;
  shadow: string; // colore dell'ombra dura
  outline: string; // colore del contorno
  scrim: string;
  white: string;
};

export const lightColors: ColorTokens = {
  ink: palette.ink,
  ground: palette.paper,
  surface: palette.paper,
  accent: palette.strawberry,
  accentText: palette.ink,
  accentInk: palette.strawberryDeep,
  leaf: palette.leaf,
  sky: palette.sky,
  butter: palette.butter,
  blush: palette.blush,
  blushSoft: palette.blushSoft,
  skySoft: palette.skySoft,
  butterSoft: palette.butterSoft,
  leafSoft: palette.leafSoft,
  shadow: palette.ink,
  outline: palette.ink,
  scrim: "rgba(34,18,31,0.45)",
  white: palette.white,
};

/** Tema scuro predisposto (fondo inchiostro, testo carta, stessi accenti). Non è il default. */
export const darkColors: ColorTokens = {
  ...lightColors,
  ink: palette.paper,
  ground: palette.ink,
  surface: "#3A2236",
  accentText: palette.ink,
  accentInk: palette.strawberry,
  shadow: "#0F0710",
  outline: palette.paper,
  scrim: "rgba(15,7,16,0.6)",
};

/** Scala 4/8. */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

/** Margine di pagina. */
export const PAGE_MARGIN = 20;

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, round: 999 } as const;

export const outline = { width: 2.5 } as const;

/** Offset dell'ombra dura (px giù-destra). */
export const shadowOffset = { sm: 3, md: 4, lg: 5 } as const;

export const tilt = { max: 2 } as const;

export const fonts = {
  display: "BagelFatOne_400Regular",
  body: "Figtree_400Regular",
  bodyMedium: "Figtree_500Medium",
  bodySemi: "Figtree_600SemiBold",
  bodyBold: "Figtree_700Bold",
} as const;

/** Varianti tipografiche. Tracking in em (convertito in px dal componente Text). */
export const type = {
  hero: { family: fonts.display, size: 52, line: 1.0, tracking: -0.03 },
  display: { family: fonts.display, size: 36, line: 1.0, tracking: -0.025 },
  title: { family: fonts.display, size: 24, line: 1.05, tracking: -0.02 },
  body: { family: fonts.body, size: 17, line: 1.45, tracking: 0 },
  bodyStrong: { family: fonts.bodyBold, size: 17, line: 1.45, tracking: 0 },
  caption: { family: fonts.bodySemi, size: 15, line: 1.4, tracking: 0 },
} as const;
export type TypeVariant = keyof typeof type;

/** Movimento. Molle per il tocco, bezier per il resto, mai ease-in. */
export const motion = {
  spring: { duration: 400, dampingRatio: 1 },
  springSheet: { duration: 300, dampingRatio: 0.8 },
  springSnappy: { duration: 300, dampingRatio: 0.7 },
  springBouncy: { duration: 450, dampingRatio: 0.5 },
  easeOut: Easing.bezier(0.23, 1, 0.32, 1),
  easeInOut: Easing.bezier(0.77, 0, 0.175, 1),
  duration: { press: 110, release: 160, enter: 280, exit: 200, tab: 0, toast: 260 },
  stagger: 50,
  pressScale: 0.97,
} as const;
