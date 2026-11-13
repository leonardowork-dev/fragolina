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
    static let petGalleryName = "Il vostro pet"
    static let petGalleryDesc = "La fragolina che curate in due: la sua faccia dice come sta."

    static let noteGalleryName = "Biglietto"
    static let noteGalleryDesc = "Il disegno o la scritta che ti lascia lei. Sparisce dopo un'ora."
    static let distGalleryName = "Distanza tra noi"
    static let distGalleryDesc = "Quanti chilometri ci sono fra voi due."

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

    // ---- Pet (stesse parole di src/lib/strings.it.ts, sezione pet: le confronta tests/swiftParity.test.ts) ----
    static let petDefaultName = "Fragolina"
    static let petEggTitle = "L'uovo"
    static let petEggLine = "Toccatelo in due."
    static let petNeedFood = "Pancia"
    static let petNeedLove = "Coccole"
    static let petNeedEnergy = "Sonno"
    static let petLockEmpty = "Apri Fragolina"
    static func petSay(_ mood: String) -> String {
        switch mood {
        case "asleep": return "Zzz…"
        case "away": return "Dormiva. Vi aspettava."
        case "love": return "Vi vuole bene."
        case "happy": return "Che bella giornata."
        case "calm": return "Tutto tranquillo."
        case "hungry": return "Ha fame."
        case "waiting": return "Vi aspetta."
        case "sleepy": return "Ha sonno."
        default: return petEggLine
        }
    }
    static func petFoodGiven(_ id: String) -> String {
        switch id {
        case "mora": return "una mora"
        case "lampone": return "un lampone"
        case "mirtillo": return "un mirtillo"
        case "pesca": return "una pesca"
        default: return "un frutto"
        }
    }
    /// `who` = nil quando sei tu ("Hai dato…"). `nil` se il tipo di cura non è da raccontare.
    static func petLogLine(kind: String, who: String?, item: String) -> String? {
        switch kind {
        case "feed": return who.map { "\($0) ha dato \(petFoodGiven(item))" } ?? "Hai dato \(petFoodGiven(item))"
        case "cuddle": return who.map { "\($0) ha fatto le coccole" } ?? "Hai fatto le coccole"
        case "play": return who.map { "\($0) ha giocato" } ?? "Hai giocato"
        case "sleep": return who.map { "\($0) ha spento la luce" } ?? "Hai spento la luce"
        case "hatch": return who.map { "\($0) l'ha fatto nascere" } ?? "L'hai fatto nascere"
        default: return nil
        }
    }

    // ---- Biglietto (stesse parole di src/lib/strings.it.ts: note, draw) ----
    static let noteEmptyTitle = "Niente biglietti"
    static let noteEmptyShort = "Nessun biglietto"
    static let noteEmptySub = "Toccami per disegnare."
    static let noteEmptyLock = "Disegna"
    static func noteBy(_ name: String, _ ago: String) -> String { "da \(name) · \(ago)" }
    static func noteByMe(_ ago: String) -> String { "da te · \(ago)" }
    static func noteLeaves(_ min: Int) -> String { min <= 1 ? "sparisce tra meno di un minuto" : "sparisce tra \(min) min" }

    // ---- Distanza (stesse parole di src/lib/strings.it.ts, sezione distance) ----
    static let distTitle = "Distanza"
    static let distNear = "vicinissimi"
    static func distKm(_ big: String) -> String { "a \(big) km" }
    static let distHidden = "Distanza nascosta"
    static func distHiddenSub(_ name: String) -> String { "\(name) ha scelto di non condividerla." }
    static let distMineOff = "La tua è spenta"
    static let distMineOffSub = "Accendi «Condividi la distanza» da Noi."
    static let distNone = "Non ancora condivisa"
    static func distNoneSub(_ name: String) -> String { "Appena \(name) la condivide, la vedi qui." }
    static let distUnpaired = "Manca una persona"
    static let distUnpairedSub = "Collegatevi dall'app."
    static func distUpdated(_ ago: String) -> String { "aggiornata \(ago)" }
    static let distKmUnit = "km"

    // ---- "aggiornato" ----
    static func updated(_ ago: String) -> String { "aggiornato " + ago }

    // ---- Accessibilità ----
    static func a11yMood(_ name: String, _ label: String) -> String { "\(name): \(label)" }
}
