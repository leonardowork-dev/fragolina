/** Tipi della zona privata di coppia. Nessun testo qui: le stringhe stanno in strings.it.ts (sezione `zone`). */
export type Place = "letto" | "divano" | "doccia" | "auto" | "fuori" | "altro";
export const PLACES: readonly Place[] = ["letto", "divano", "doccia", "auto", "fuori", "altro"];
export type Starter = "a" | "b" | "both";
export type IdeaLevel = "dolce" | "piccante" | "audace";
export type TonightAnswer = "yes" | "maybe" | "no";

export type ZEntry = {
  id: string;
  day: string; // AAAA-MM-GG
  at: number;
  place: Place | null;
  starter: Starter | null;
  rating: number | null; // 1-5
  note: string | null;
  by: "a" | "b" | null;
  updatedAt: number;
};

export type ZIdea = { id: string; text: string; level: IdeaLevel; mine: boolean };
export type ZVoucher = {
  id: string;
  title: string;
  expires: string | null;
  redeemedAt: number | null;
  createdAt: number;
  fromMe: boolean;
};
export type ZSignal = { level: 1 | 2 | 3; at: number; expiresAt: number };

export type ZSnapshot = {
  now: number;
  today: string;
  pulse: number;
  entries: ZEntry[];
  customIdeas: ZIdea[];
  wishesMine: string[];
  matches: string[];
  tonight: { day: string; mine: TonightAnswer | null; otherAnswered: boolean; result: "match" | "nomatch" | null };
  signal: { incoming: ZSignal | null; mine: ZSignal | null };
  vouchers: ZVoucher[];
};

export const emptyZSnapshot = (): ZSnapshot => ({
  now: 0,
  today: "",
  pulse: 0,
  entries: [],
  customIdeas: [],
  wishesMine: [],
  matches: [],
  tonight: { day: "", mine: null, otherAnswered: false, result: null },
  signal: { incoming: null, mine: null },
  vouchers: [],
});

/** Operazioni che il telefono può mettere in coda quando non c'è rete (stessa idea della coda del resto dell'app). */
export type ZOp =
  | { kind: "log"; key: string; id: string; day: string; at: number; place: Place | null; starter: Starter | null; rating: number | null; note: string | null }
  | { kind: "logDelete"; key: string; id: string }
  | { kind: "wish"; key: string; idea: string; on: boolean }
  | { kind: "ideaAdd"; key: string; id: string; text: string; level: IdeaLevel }
  | { kind: "ideaDelete"; key: string; id: string }
  | { kind: "tonight"; key: string; answer: TonightAnswer }
  | { kind: "signal"; key: string; level: 1 | 2 | 3 }
  | { kind: "signalClear"; key: string }
  | { kind: "voucherAdd"; key: string; id: string; title: string; expires: string | null }
  | { kind: "voucherRedeem"; key: string; id: string }
  | { kind: "voucherDelete"; key: string; id: string }
  | { kind: "wipe"; key: string };
