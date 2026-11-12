import Foundation

/// TUTTE le stringhe italiane dei widget, in un solo posto.
/// Il widget gira in un processo isolato e non può importare `src/lib/strings.it.ts` dell'app (DECISIONS.md):
/// le parole sono qui, brevi e calde. Niente testo scritto direttamente nelle viste.
enum WS {
    // ---- Galleria dei widget (nome + descrizione che iOS mostra quando si aggiunge un widget) ----
    static let legacyName = "Fragolina"
    static let legacyDesc = "L'umore di lei, i pensieri e i giorni insieme, tutto in uno."
    static let moodName = "Il suo umore"
    static let moodDesc = "Come sta lei oggi. Nel medio ci siete tutti e due."
    static let pingName = "Penso a te"
    static let pingDesc = "Tocca e le arriva un pensiero. Conta quelli che ricevi."
    static let daysName = "Giorni insieme"
    static let daysDesc = "Quanti giorni, e la prossima ricorrenza."
    static let lockName = "Noi, sul blocco"
    static let lockDesc = "Giorni insieme e umore di lei sulla schermata di blocco."
    static let lockMoodName = "Umore, sul blocco"
    static let lockMoodDesc = "La faccina di lei sulla schermata di blocco."

    // ---- Stati comuni ----
    static let emptyTitle = "Ancora niente"
    static let emptySub = "Apri Fragolina per collegarvi."
    static let unpairedTitle = "Manca una persona"
    static let unpairedSub = "Apri Fragolina per collegarvi."
    static let staleTitle = "Dorme da un po'"
    static let staleTitleShort = "Dorme"
    static let staleSub = "Apri Fragolina per svegliarla."
    static let lockEmpty = "Apri Fragolina"
    static let lockEmptyShort = "Collegati"

    // ---- Umore ----
    static let moodNone = "Ancora niente"
    static let moodNoneHint = "Appena sceglie, lo vedi qui."
    static let you = "Tu"
    static let youNone = "Scegli il tuo"
    static func moodSince(_ ago: String) -> String { "da " + ago }
    static let moodSinceNow = "adesso"

    // ---- Penso a te ----
    static let pingTitle = "Penso a te"
    static let pingTap = "Tocca: penso a te"
    static let pingTapShort = "Tocca"
    static func pingsFrom(_ name: String) -> String { "pensieri da \(name)" }
    static let pingsReceived = "pensieri ricevuti"
    static func pingLast(_ ago: String) -> String { "l'ultimo \(ago)" }
    static let pingNone = "Ancora nessuno"
    static func pingYouToday(_ n: Int) -> String { n == 1 ? "Tu: 1 oggi" : "Tu: \(n) oggi" }

    // ---- Giorni ----
    static let daysLabel = "giorni insieme"
    static let daysLabelOne = "giorno insieme"
    static let daysPick = "Da quando?"
    static let daysPickHint = "Scegli la data in Fragolina."
    static let daysStart = "Si parte oggi"
    static let nextTitle = "Prossima festa"
    static func nextInline(_ until: String, _ label: String) -> String {
        let s = "\(until): \(label)"
        return s.prefix(1).uppercased() + s.dropFirst()
    }
    static func todayParty(_ label: String) -> String { "Oggi: \(label)!" }
    static let partyLine = "Auguri a voi"

    // ---- Schermata di blocco ----
    static func lockDaysWith(_ days: String, _ name: String) -> String { "\(days) giorni con \(name)" }
    static func lockDaysWithOne(_ name: String) -> String { "1 giorno con \(name)" }
    static func lockPings(_ n: Int) -> String { n == 1 ? "1 pensiero" : "\(n) pensieri" }

    // ---- "aggiornato" ----
    static func updated(_ ago: String) -> String { "aggiornato " + ago }

    // ---- Accessibilità ----
    static func a11yMood(_ name: String, _ label: String) -> String { "\(name): \(label)" }
}
