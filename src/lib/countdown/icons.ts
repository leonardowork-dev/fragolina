import data from "./icons.json";

/**
 * I simboli del conto alla rovescia: un set NOSTRO (niente emoji), disegnato su una griglia 100×100 con soli comandi
 * M L C Z assoluti. Gli STESSI tracciati finiscono nel widget (`targets/widget/EventIcons.swift`, generato da
 * `scripts/gen-event-icons.mjs`: un test controlla che siano uguali). I colori sono nomi della palette.
 */
export const EVENT_ICONS = ["heart", "plane", "ticket", "cake", "gift", "sun", "star", "house", "train", "balloon"] as const;
export type EventIconId = (typeof EVENT_ICONS)[number];

export type IconFill = "strawberry" | "butter" | "sky" | "leaf" | "blush" | "paper" | "ink" | "none";
export type IconShape = { d: string; fill: IconFill };

export const ICON_SHAPES = data as unknown as Record<EventIconId, IconShape[]>;
export const isEventIcon = (v: unknown): v is EventIconId => typeof v === "string" && (EVENT_ICONS as readonly string[]).includes(v);
