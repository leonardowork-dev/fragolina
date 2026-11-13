import Foundation

// SOLO Foundation in questo file (niente SwiftUI/WidgetKit): si compila e si prova anche su Linux
// (scripts/swift-check.mjs), contro le stesse fixture di vitest.

// MARK: - Dati condivisi (JSON scritto dall'app: src/lib/widgetPayload.ts, fixture in tests/fixtures/)

/// Un tratto del disegno: colore della palette, spessore 1 (fine) o 2 (spesso), punti interi 0...1000 (tela quadrata).
struct NoteStroke: Codable, Equatable {
    var c: String?
    var w: Int?
    var p: [[Int]]?
}

/// Contenuto del biglietto: un disegno (`strokes`) oppure una scritta (`text` + sfondo `bg`). Stesso JSON del server.
struct NoteContent: Codable, Equatable {
    var strokes: [NoteStroke]?
    var text: String?
    var bg: String?
}

/// Tutti i campi sono opzionali e si leggono uno per uno: un payload v1, v2, v3 o incompleto si legge comunque,
/// mai un crash; un campo del tipo sbagliato vale `nil` ma non butta via gli altri.
/// NOTA: i campi si AGGIUNGONO in fondo (v2 = prima parte, v3 = seconda, v4 = il pet, v5 = biglietto, distanza e accesso al feed). tests/widgetPayload.test.ts controlla
/// che nomi, tipi e ordine coincidano con la fixture.
struct Snapshot: Codable {
    var v: Int?
    var updatedAt: Double?      // ms da epoch: ultima conferma dei dati col server
    var paired: Bool?
    var partnerName: String?
    var moodId: String?
    var moodLabel: String?
    var moodAt: Double?
    var thinkingToday: Int?     // pensieri che HAI mandato oggi
    var pingsReceived: Int?     // pensieri che HAI ricevuto in totale
    var lastPingAt: Double?     // ultimo pensiero ricevuto (ms)
    var startDate: String?      // AAAA-MM-GG
    var myName: String?         // v3
    var myMoodId: String?
    var myMoodLabel: String?
    var myMoodAt: Double?
    var questionText: String?
    var questionMineDone: Bool?
    var questionBothDone: Bool?
    var petHatched: Bool?       // v4 (pet condiviso)
    var petStage: String?       // egg | seed | sprout | berry | big
    var petName: String?
    var petFood: Int?           // bisogni 0...1000 all'istante petAt (poi scendono da soli)
    var petLove: Int?
    var petEnergy: Int?
    var petAt: Double?
    var petSleepUntil: Double?  // fine della nanna (ms), 0 = non dorme
    var petLastAt: Double?      // ultima cura vera (ms)
    var petDay: String?         // ultimo giorno di cura AAAA-MM-GG
    var petBoth: Bool?          // quel giorno avete curato entrambi
    var petLastBy: String?      // "me" | "partner" | ""
    var petLastKind: String?    // feed | cuddle | play | sleep | hatch
    var petLastItem: String?
    var noteId: String?         // v5 (biglietto: "" = nessuno)
    var noteKind: String?       // draw | text
    var noteContent: NoteContent?
    var noteBy: String?         // me | partner
    var noteByName: String?
    var noteAt: Double?
    var noteExpiresAt: Double?  // il widget calcola da solo la scadenza
    var shareMine: Bool?        // condivido la mia posizione?
    var myLatE2: Int?           // gradi × 100 (≈ 1 km)
    var myLonE2: Int?
    var myLocAt: Double?
    var partnerLocState: String? // ok | hidden | mine_off | none | ""
    var partnerLatE2: Int?
    var partnerLonE2: Int?
    var partnerLocAt: Double?
    var feedUrl: String?        // Percorso B: URL Supabase + chiave PUBBLICA + token del widget (mai la chiave segreta di amministrazione)
    var feedKey: String?
    var feedToken: String?
}

extension Snapshot {
    enum CodingKeys: String, CodingKey {
        case v, updatedAt, paired, partnerName, moodId, moodLabel, moodAt, thinkingToday, pingsReceived
        case lastPingAt, startDate, myName, myMoodId, myMoodLabel, myMoodAt
        case questionText, questionMineDone, questionBothDone
        case petHatched, petStage, petName, petFood, petLove, petEnergy, petAt, petSleepUntil
        case petLastAt, petDay, petBoth, petLastBy, petLastKind, petLastItem
        case noteId, noteKind, noteContent, noteBy, noteByName, noteAt, noteExpiresAt
        case shareMine, myLatE2, myLonE2, myLocAt, partnerLocState, partnerLatE2, partnerLonE2, partnerLocAt
        case feedUrl, feedKey, feedToken
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func get<T: Decodable>(_ type: T.Type, _ key: CodingKeys) -> T? {
            (try? c.decodeIfPresent(type, forKey: key)) ?? nil
        }
        self.init(
            v: get(Int.self, .v),
            updatedAt: get(Double.self, .updatedAt),
            paired: get(Bool.self, .paired),
            partnerName: get(String.self, .partnerName),
            moodId: get(String.self, .moodId),
            moodLabel: get(String.self, .moodLabel),
            moodAt: get(Double.self, .moodAt),
            thinkingToday: get(Int.self, .thinkingToday),
            pingsReceived: get(Int.self, .pingsReceived),
            lastPingAt: get(Double.self, .lastPingAt),
            startDate: get(String.self, .startDate),
            myName: get(String.self, .myName),
            myMoodId: get(String.self, .myMoodId),
            myMoodLabel: get(String.self, .myMoodLabel),
            myMoodAt: get(Double.self, .myMoodAt),
            questionText: get(String.self, .questionText),
            questionMineDone: get(Bool.self, .questionMineDone),
            questionBothDone: get(Bool.self, .questionBothDone),
            petHatched: get(Bool.self, .petHatched),
            petStage: get(String.self, .petStage),
            petName: get(String.self, .petName),
            petFood: get(Int.self, .petFood),
            petLove: get(Int.self, .petLove),
            petEnergy: get(Int.self, .petEnergy),
            petAt: get(Double.self, .petAt),
            petSleepUntil: get(Double.self, .petSleepUntil),
            petLastAt: get(Double.self, .petLastAt),
            petDay: get(String.self, .petDay),
            petBoth: get(Bool.self, .petBoth),
            petLastBy: get(String.self, .petLastBy),
            petLastKind: get(String.self, .petLastKind),
            petLastItem: get(String.self, .petLastItem),
            noteId: get(String.self, .noteId),
            noteKind: get(String.self, .noteKind),
            noteContent: get(NoteContent.self, .noteContent),
            noteBy: get(String.self, .noteBy),
            noteByName: get(String.self, .noteByName),
            noteAt: get(Double.self, .noteAt),
            noteExpiresAt: get(Double.self, .noteExpiresAt),
            shareMine: get(Bool.self, .shareMine),
            myLatE2: get(Int.self, .myLatE2),
            myLonE2: get(Int.self, .myLonE2),
            myLocAt: get(Double.self, .myLocAt),
            partnerLocState: get(String.self, .partnerLocState),
            partnerLatE2: get(Int.self, .partnerLatE2),
            partnerLonE2: get(Int.self, .partnerLonE2),
            partnerLocAt: get(Double.self, .partnerLocAt),
            feedUrl: get(String.self, .feedUrl),
            feedKey: get(String.self, .feedKey),
            feedToken: get(String.self, .feedToken)
        )
    }

    /// Legge un JSON (qualsiasi versione). `nil` solo se non è un oggetto JSON.
    static func parse(_ raw: String) -> Snapshot? {
        guard let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(Snapshot.self, from: data)
    }
}

// MARK: - Calendario a numeri interi (stessa aritmetica di src/lib/recurrence.ts)

struct Civil: Equatable {
    let y: Int
    let m: Int
    let d: Int

    var iso: String {
        func p(_ n: Int, _ w: Int) -> String { String(repeating: "0", count: max(0, w - String(n).count)) + String(n) }
        return "\(p(y, 4))-\(p(m, 2))-\(p(d, 2))"
    }
}

private func floorDiv(_ a: Int, _ b: Int) -> Int {
    let q = a / b
    return (a % b != 0 && ((a < 0) != (b < 0))) ? q - 1 : q
}

func daysInMonth(_ y: Int, _ m: Int) -> Int {
    if m == 2 { return ((y % 4 == 0 && y % 100 != 0) || y % 400 == 0) ? 29 : 28 }
    return [4, 6, 9, 11].contains(m) ? 30 : 31
}

func parseCivil(_ iso: String?) -> Civil? {
    guard let iso, iso.count == 10 else { return nil }
    let parts = iso.split(separator: "-", omittingEmptySubsequences: false)
    guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
          let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else { return nil }
    guard m >= 1, m <= 12, d >= 1, d <= daysInMonth(y, m) else { return nil }
    return Civil(y: y, m: m, d: d)
}

/// Giorni dal 1970-01-01 (Howard Hinnant).
func daysFromCivil(_ c: Civil) -> Int {
    let yy = c.m <= 2 ? c.y - 1 : c.y
    let era = floorDiv(yy, 400)
    let yoe = yy - era * 400
    let doy = (153 * (c.m + (c.m > 2 ? -3 : 9)) + 2) / 5 + c.d - 1
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    return era * 146097 + doe - 719468
}

func civilFromDays(_ z0: Int) -> Civil {
    let z = z0 + 719468
    let era = floorDiv(z, 146097)
    let doe = z - era * 146097
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
    let y = yoe + era * 400
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
    let mp = (5 * doy + 2) / 153
    let d = doy - (153 * mp + 2) / 5 + 1
    let m = mp < 10 ? mp + 3 : mp - 9
    return Civil(y: m <= 2 ? y + 1 : y, m: m, d: d)
}

func civilToday(_ date: Date, calendar: Calendar = .current) -> Civil {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return Civil(y: c.year ?? 1970, m: c.month ?? 1, d: c.day ?? 1)
}

// MARK: - Ricorrenze (regole in src/lib/recurrence.ts)

enum RecurrenceKind: String {
    case month, year, days
}

struct Recurrence: Equatable {
    let date: Civil
    let daysUntil: Int
    let kind: RecurrenceKind
    let count: Int
    let label: String
}

func monthsary(_ start: Civil, _ k: Int) -> Civil {
    let total = start.y * 12 + (start.m - 1) + k
    let y = floorDiv(total, 12)
    let m = total - y * 12 + 1
    return Civil(y: y, m: m, d: min(start.d, daysInMonth(y, m)))
}

func nextDayMilestone(_ n: Int) -> Int {
    if n <= 100 { return 100 }
    if n <= 1000 { return ((n + 99) / 100) * 100 }
    return ((n + 499) / 500) * 500
}

func monthsLabel(_ k: Int) -> (kind: RecurrenceKind, count: Int, label: String) {
    let years = k / 12
    let rem = k % 12
    let y = years == 1 ? "1 anno" : "\(years) anni"
    let m = rem == 1 ? "1 mese" : "\(rem) mesi"
    if rem == 0 { return (.year, years, y) }
    return (.month, k, years == 0 ? m : "\(y) e \(m)")
}

func nextRecurrence(start startIso: String?, today: Civil) -> Recurrence? {
    guard let start = parseCivil(startIso) else { return nil }
    let startDay = daysFromCivil(start)
    let todayDay = daysFromCivil(today)
    let elapsed = todayDay - startDay
    if elapsed < 0 { return nil }

    var k = max(1, (today.y - start.y) * 12 + (today.m - start.m))
    while daysFromCivil(monthsary(start, k)) < todayDay { k += 1 }
    let mDay = daysFromCivil(monthsary(start, k))
    let ml = monthsLabel(k)

    let target = nextDayMilestone(elapsed)
    let dDay = startDay + target

    // stesso giorno: anniversario > giorni > mesi
    func rank(_ kind: RecurrenceKind) -> Int { kind == .year ? 0 : (kind == .days ? 1 : 2) }
    let monthWins = mDay < dDay || (mDay == dDay && rank(ml.kind) < rank(.days))
    if monthWins {
        return Recurrence(date: civilFromDays(mDay), daysUntil: mDay - todayDay, kind: ml.kind, count: ml.count, label: ml.label)
    }
    return Recurrence(date: civilFromDays(dDay), daysUntil: dDay - todayDay, kind: .days, count: target, label: "\(target) giorni")
}

/// Giorni interi dalla data d'inizio a oggi (mai negativi); `nil` se manca la data.
func daysTogether(start startIso: String?, today: Civil) -> Int? {
    guard let start = parseCivil(startIso) else { return nil }
    return max(0, daysFromCivil(today) - daysFromCivil(start))
}

func untilText(_ daysUntil: Int) -> String {
    if daysUntil <= 0 { return "oggi" }
    if daysUntil == 1 { return "domani" }
    return "tra \(daysUntil) giorni"
}

private let monthShort = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]

/// "14 mag"
func shortDate(_ c: Civil) -> String {
    "\(c.d) " + monthShort[max(0, min(11, c.m - 1))]
}

// MARK: - "X fa" (stesse soglie di timeAgo in src/lib/time.ts)

/// "adesso", "5 min fa", "3 h fa", "ieri", "4 giorni fa".
func agoIt(_ seconds: TimeInterval) -> String {
    let s = max(0, Int(seconds.rounded()))
    if s < 45 { return "adesso" }
    let m = Int((Double(s) / 60).rounded())
    if m < 60 { return "\(m) min fa" }
    let h = Int((Double(m) / 60).rounded())
    if h < 24 { return "\(h) h fa" }
    let d = Int((Double(h) / 24).rounded())
    return d == 1 ? "ieri" : "\(d) giorni fa"
}

/// "5 min", "2 h", "3 g": per i riquadri stretti ("da 2 h").
func ageShortIt(_ seconds: TimeInterval) -> String {
    let a = max(0, seconds)
    if a < 90 { return "adesso" }
    if a < 3600 { return "\(Int(a / 60)) min" }
    if a < 86400 { return "\(Int(a / 3600)) h" }
    return "\(Int(a / 86400)) g"
}

// MARK: - Voce della timeline

let hardStaleAfter: TimeInterval = 48 * 3600   // oltre: la fragola dorme
let softStaleAfter: TimeInterval = 3 * 3600    // oltre: "aggiornato X fa"

enum EntryState {
    case empty      // nessun dato (app mai aperta / container non leggibile)
    case unpaired   // dati presenti ma non collegati
    case hardStale  // dati fermi da più di 48 h
    case ok
}

struct FragolinaEntry {
    let date: Date
    let snapshot: Snapshot?
    let group: String?          // gruppo risolto (diagnostica)
    /// Percorso B: l'ultima risposta valida del feed (biglietto + posizione di lei). `nil` = non c'è (o la rete non va).
    var feed: Feed? = nil
    /// Il server ha detto "token non valido" (sei uscito dalla coppia): niente biglietto, niente distanza.
    var feedRevoked: Bool = false
}

extension FragolinaEntry {
    var isEmpty: Bool { snapshot == nil }
    /// Un payload v1 non aveva `paired`: se c'è un nome lo si considera collegato.
    var isPaired: Bool { snapshot?.paired ?? (snapshot?.partnerName != nil) }
    var age: TimeInterval? {
        guard let ms = snapshot?.updatedAt, ms > 0 else { return nil }
        return max(0, date.timeIntervalSince1970 - ms / 1000)
    }
    var isHardStale: Bool { (age ?? 0) > hardStaleAfter }
    var isSoftStale: Bool { (age ?? 0) > softStaleAfter && !isHardStale }
    var state: EntryState {
        if snapshot == nil { return .empty }
        if !isPaired { return .unpaired }
        if isHardStale { return .hardStale }
        return .ok
    }

    var today: Civil { civilToday(date) }
    var daysValue: Int? { daysTogether(start: snapshot?.startDate, today: today) }
    var daysText: String { daysValue.map { String($0) } ?? "–" }
    var recurrence: Recurrence? { nextRecurrence(start: snapshot?.startDate, today: today) }

    var partner: String {
        let n = snapshot?.partnerName ?? ""
        return n.isEmpty ? "Lei" : n
    }
    var me: String {
        let n = snapshot?.myName ?? ""
        return n.isEmpty ? WS.you : n
    }
    /// Il suo nome per i riquadri stretti: intero se corto (≤ 14 lettere), altrimenti la prima parola.
    var partnerShort: String {
        let n = partner
        if n.count <= 14 { return n }
        return n.split(whereSeparator: { $0 == " " || $0 == "-" }).first.map(String.init) ?? n
    }
    /// Il mio nome per i riquadri stretti: la prima parola; se è ancora lunga (> 12 lettere) solo "Tu".
    var meShort: String {
        let first = me.split(whereSeparator: { $0 == " " || $0 == "-" }).first.map(String.init) ?? me
        return first.count > 12 ? WS.you : first
    }
    var moodId: String? { snapshot?.moodId }
    var moodLabel: String { snapshot?.moodLabel ?? "" }
    var myMoodId: String? { snapshot?.myMoodId }
    var myMoodLabel: String { snapshot?.myMoodLabel ?? "" }
    var thoughts: Int { snapshot?.thinkingToday ?? 0 }
    var received: Int { snapshot?.pingsReceived ?? 0 }

    /// "aggiornato 5 h fa"
    var updatedText: String { WS.updated(agoIt(age ?? 0)) }
    /// "5 h", "2 g"
    var ageShort: String { ageShortIt(age ?? 0) }

    /// Da quanto lei ha scelto l'umore: "da 2 h".
    var moodSinceText: String? {
        guard let ms = snapshot?.moodAt else { return nil }
        return sinceText(ms)
    }
    var myMoodSinceText: String? {
        guard let ms = snapshot?.myMoodAt else { return nil }
        return sinceText(ms)
    }
    private func sinceText(_ ms: Double) -> String {
        let s = max(0, date.timeIntervalSince1970 - ms / 1000)
        return s < 90 ? WS.moodSinceNow : WS.moodSince(ageShortIt(s))
    }

    /// "l'ultimo 10 min fa"; `nil` se non ne ha mai mandati.
    var lastPingText: String? {
        guard let ms = snapshot?.lastPingAt else { return nil }
        return WS.pingLast(agoIt(date.timeIntervalSince1970 - ms / 1000))
    }
}

/// Momenti in cui il widget si ridisegna da solo (senza che l'app lo ricarichi):
/// ogni 10 min per 3 h, ogni 30 min fino a 12 h, le soglie esatte "dati vecchi" (3 h) e "dorme" (48 h) dopo
/// l'ultimo aggiornamento, e un attimo dopo ogni mezzanotte dei prossimi 3 giorni (scatta il contatore dei giorni).
func timelineDates(now: Date, updatedAtMs: Double?, calendar: Calendar = .current) -> [Date] {
    var out: [Date] = [now]
    for i in 1...18 { out.append(now.addingTimeInterval(Double(i) * 10 * 60)) }
    for i in 1...18 { out.append(now.addingTimeInterval(3 * 3600 + Double(i) * 30 * 60)) }
    if let ms = updatedAtMs, ms > 0 {
        let base = Date(timeIntervalSince1970: ms / 1000)
        for t in [softStaleAfter + 1, hardStaleAfter + 1] {
            let d = base.addingTimeInterval(t)
            if d > now { out.append(d) }
        }
    }
    var cursor = now
    for _ in 0..<3 {
        guard let m = calendar.nextDate(after: cursor, matching: DateComponents(hour: 0, minute: 0, second: 10), matchingPolicy: .nextTime) else { break }
        out.append(m)
        cursor = m
    }
    let sorted = out.sorted()
    var unique: [Date] = []
    for d in sorted where unique.last.map({ d.timeIntervalSince($0) >= 1 }) ?? true { unique.append(d) }
    return unique
}

// MARK: - Pet condiviso (regole in src/lib/pet/rules.ts, specchio in src/lib/pet/widgetModel.ts)

/// Tutto in interi (bisogni 0...1000, tempi in millisecondi): gli stessi numeri di TypeScript e di SQL.
enum PetRules {
    static let decayFood = 45
    static let decayLove = 30
    static let decayEnergy = 20
    static let lowNeed = 350
    static let happyAvg = 650.0
    static let awayAfterMs: Double = 72 * 3_600_000
    static let hourMs: Double = 3_600_000
}

struct PetNeeds: Equatable {
    var food: Int
    var love: Int
    var energy: Int
}

/// Un bisogno dopo `dtMs`: scende di `rate` unità l'ora (parte intera), mai sotto 0.
func petDecay(_ v: Int, _ rate: Int, _ dtMs: Double) -> Int {
    let lost = Int((Double(rate) * max(dtMs, 0) / PetRules.hourMs).rounded(.down))
    return min(1000, max(0, v - lost))
}

func petNeedsAt(food: Int, love: Int, energy: Int, at: Double, now: Double) -> PetNeeds {
    let dt = now - at
    return PetNeeds(
        food: petDecay(food, PetRules.decayFood, dt),
        love: petDecay(love, PetRules.decayLove, dt),
        energy: petDecay(energy, PetRules.decayEnergy, dt)
    )
}

/// La faccia: egg, asleep, away, love, happy, calm, hungry, waiting, sleepy.
func petMoodId(hatched: Bool, needs n: PetNeeds, sleepUntil: Double, lastAt: Double, day: String, both: Bool, now: Double, todayIso: String) -> String {
    if !hatched { return "egg" }
    if now < sleepUntil { return "asleep" }
    if now - lastAt > PetRules.awayAfterMs { return "away" }
    // il più basso; a parità: pancia, poi coccole, poi energia
    var low = "food"
    var lowV = n.food
    if n.love < lowV { low = "love"; lowV = n.love }
    if n.energy < lowV { low = "energy"; lowV = n.energy }
    if lowV < PetRules.lowNeed { return low == "food" ? "hungry" : (low == "love" ? "waiting" : "sleepy") }
    if both && day == todayIso { return "love" }
    return Double(n.food + n.love + n.energy) / 3 >= PetRules.happyAvg ? "happy" : "calm"
}

/// Pallini pieni (1-3) di un bisogno.
func petDots(_ v: Int) -> Int { v < PetRules.lowNeed ? 1 : (v < 650 ? 2 : 3) }

extension FragolinaEntry {
    var petHatched: Bool { snapshot?.petHatched ?? false }
    var petStage: String {
        let s = snapshot?.petStage ?? ""
        return s.isEmpty ? "egg" : s
    }
    var petNameText: String {
        let n = snapshot?.petName ?? ""
        return n.isEmpty ? WS.petDefaultName : n
    }
    var petNowMs: Double { date.timeIntervalSince1970 * 1000 }
    /// I bisogni AL MOMENTO della voce della timeline (non al momento della scrittura).
    var petNeeds: PetNeeds {
        petNeedsAt(
            food: snapshot?.petFood ?? 0, love: snapshot?.petLove ?? 0, energy: snapshot?.petEnergy ?? 0,
            at: snapshot?.petAt ?? 0, now: petNowMs
        )
    }
    var petMood: String {
        petMoodId(
            hatched: petHatched, needs: petNeeds, sleepUntil: snapshot?.petSleepUntil ?? 0,
            lastAt: snapshot?.petLastAt ?? 0, day: snapshot?.petDay ?? "", both: snapshot?.petBoth ?? false,
            now: petNowMs, todayIso: today.iso
        )
    }
    var petSay: String { petHatched ? WS.petSay(petMood) : WS.petEggLine }
    /// "Nikole ha dato una mora · 10 min fa"; `nil` se non c'è una cura da raccontare.
    var petLastLine: String? {
        guard petHatched, let at = snapshot?.petLastAt, at > 0,
              let by = snapshot?.petLastBy, !by.isEmpty,
              let text = WS.petLogLine(kind: snapshot?.petLastKind ?? "", who: by == "me" ? nil : partner, item: snapshot?.petLastItem ?? "")
        else { return nil }
        return text + " · " + agoIt(date.timeIntervalSince1970 - at / 1000)
    }
}

/// Voci della timeline del pet: ogni ora per 24 h (la faccia cambia anche con l'app chiusa), più gli istanti esatti
/// in cui cambia qualcosa di netto (fine nanna, "torna a dormire") e i `midnights` (la festa "vi vuole bene" vale
/// per il giorno). I mezzanotte li calcola il chiamante col calendario; qui si resta in puri numeri.
func petTimelineDates(now: Date, snapshot: Snapshot?, midnights: [Date]) -> [Date] {
    var out: [Date] = [now]
    for i in 1...24 { out.append(now.addingTimeInterval(Double(i) * 3600)) }
    let end = now.addingTimeInterval(24 * 3600 + 1)
    func add(_ ms: Double) {
        let d = Date(timeIntervalSince1970: ms / 1000)
        if d > now && d <= end { out.append(d) }
    }
    if snapshot?.petHatched == true {
        if let su = snapshot?.petSleepUntil, su > 0 { add(su + 1000) }
        if let la = snapshot?.petLastAt, la > 0 { add(la + PetRules.awayAfterMs + 1000) }
    }
    for m in midnights where m > now && m <= end { out.append(m) }
    let sorted = out.sorted()
    var unique: [Date] = []
    for d in sorted where unique.last.map({ d.timeIntervalSince($0) >= 1 }) ?? true { unique.append(d) }
    return unique
}

/// Le prossime `count` mezzanotti (+10 s) nel calendario locale.
func nextMidnights(after now: Date, count: Int, calendar: Calendar = .current) -> [Date] {
    var out: [Date] = []
    var cursor = now
    for _ in 0..<count {
        guard let m = calendar.nextDate(after: cursor, matching: DateComponents(hour: 0, minute: 0, second: 10), matchingPolicy: .nextTime) else { break }
        out.append(m)
        cursor = m
    }
    return out
}

// MARK: - Link dei widget (gestiti in app/+native-intent.ts e src/lib/deepLink.ts)

enum WidgetLink {
    static let ping = URL(string: "fragolina://ping")!
    static let mood = URL(string: "fragolina://mood")!
    static let us = URL(string: "fragolina://us")!
    static let home = URL(string: "fragolina://home")!
    static let pet = URL(string: "fragolina://pet")!
    static let draw = URL(string: "fragolina://draw")!
}

// MARK: - Biglietto e distanza (sessione 5). Specchio di src/lib/note/widgetModel.ts e src/lib/geo/distance.ts

/// Risposta della RPC `widget_feed` (Percorso B). `fetchedAt` lo mette il widget quando la scarica.
struct FeedNote: Codable, Equatable {
    var id: String?
    var kind: String?
    var content: NoteContent?
    var by: String?
    var byName: String?
    var createdAt: Double?
    var expiresAt: Double?
}

struct FeedPartner: Codable, Equatable {
    var name: String?
    var state: String?
    var latE2: Int?
    var lonE2: Int?
    var at: Double?
}

struct Feed: Codable, Equatable {
    var ok: Bool?
    var error: String?
    var now: Double?
    var note: FeedNote?
    var partner: FeedPartner?
    var fetchedAt: Double?

    /// `nil` se non è una risposta `ok:true` leggibile.
    static func parse(_ data: Data) -> Feed? {
        guard let f = try? JSONDecoder().decode(Feed.self, from: data), f.ok == true else { return nil }
        return f
    }
    static func parse(_ raw: String) -> Feed? { raw.data(using: .utf8).flatMap { parse($0) } }
}

enum GeoRules {
    static let earthRadiusKm = 6371.0088
    /// Sotto questa distanza si dice "vicinissimi" (le coordinate sono arrotondate a ~1 km: 0 e 1 km non si distinguono).
    static let nearKm = 2.0
    static let locStaleMs = 3.0 * 60 * 60 * 1000
}

func haversineKm(_ aLat: Int, _ aLon: Int, _ bLat: Int, _ bLon: Int) -> Double {
    func rad(_ deg: Double) -> Double { deg * Double.pi / 180 }
    let la1 = rad(Double(aLat) / 100)
    let la2 = rad(Double(bLat) / 100)
    let dLa = la2 - la1
    let dLo = rad(Double(bLon - aLon) / 100)
    let h = pow(sin(dLa / 2), 2) + cos(la1) * cos(la2) * pow(sin(dLo / 2), 2)
    return 2 * GeoRules.earthRadiusKm * asin(min(1, h.squareRoot()))
}

/// "19.000" (punto delle migliaia all'italiana, senza il locale: stesso risultato ovunque).
func groupThousands(_ n: Int) -> String {
    let digits = Array(String(max(0, n)))
    var out = ""
    for (i, ch) in digits.enumerated() {
        if i > 0 && (digits.count - i) % 3 == 0 { out += "." }
        out.append(ch)
    }
    return out
}

struct DistanceView: Equatable {
    var near: Bool
    var km: Int
    var big: String
    var unit: String
    var sentence: String
}

func distanceView(_ km: Double) -> DistanceView {
    let k = Int(km.rounded())
    if km < GeoRules.nearKm { return DistanceView(near: true, km: k, big: "0", unit: "km", sentence: WS.distNear) }
    return DistanceView(near: false, km: k, big: groupThousands(k), unit: "km", sentence: WS.distKm(groupThousands(k)))
}

struct NoteDisplay: Equatable {
    let id: String
    let kind: String
    let content: NoteContent
    let by: String
    let byName: String
    let createdAt: Double
    let expiresAt: Double
}

struct DistanceModel: Equatable {
    var state: String           // unpaired | hidden | mine_off | none | ok
    var km: Int?
    var near: Bool
    var big: String
    var unit: String
    var sentence: String
    var ageText: String?        // "aggiornata 3 h fa"
    var stale: Bool
}

extension FragolinaEntry {
    var nowMs: Double { date.timeIntervalSince1970 * 1000 }

    /// Il biglietto da mostrare a questa data (nil = niente, scaduto o pulito). Il feed, se c'è, ha l'ultima parola.
    var noteDisplay: NoteDisplay? {
        if feedRevoked { return nil }
        var n: NoteDisplay?
        if let f = feed {
            if let fn = f.note, let id = fn.id, let content = fn.content, let at = fn.createdAt, let exp = fn.expiresAt {
                n = NoteDisplay(id: id, kind: fn.kind == "text" ? "text" : "draw", content: content, by: fn.by == "me" ? "me" : "partner",
                                byName: fn.byName ?? "", createdAt: at, expiresAt: exp)
            }
        } else if let s = snapshot, let id = s.noteId, !id.isEmpty, let content = s.noteContent, let at = s.noteAt, let exp = s.noteExpiresAt {
            n = NoteDisplay(id: id, kind: s.noteKind == "text" ? "text" : "draw", content: content, by: s.noteBy == "me" ? "me" : "partner",
                            byName: s.noteByName ?? "", createdAt: at, expiresAt: exp)
        }
        guard let note = n, nowMs < note.expiresAt else { return nil }
        return note
    }

    /// "da Nikole · 12 min fa" / "da te · 3 min fa"
    var noteByLine: String? {
        guard let n = noteDisplay else { return nil }
        let ago = agoIt(date.timeIntervalSince1970 - n.createdAt / 1000)
        return n.by == "me" ? WS.noteByMe(ago) : WS.noteBy(n.byName.isEmpty ? partner : n.byName, ago)
    }
    var noteMinutesLeft: Int {
        guard let n = noteDisplay else { return 0 }
        return max(0, Int(((n.expiresAt - nowMs) / 60000).rounded(.up)))
    }

    /// La posizione di lei: dal feed se c'è, altrimenti dall'ultimo snapshot.
    var partnerLoc: FeedPartner? {
        if let p = feed?.partner { return p }
        guard let s = snapshot, let st = s.partnerLocState, !st.isEmpty else { return nil }
        return FeedPartner(name: s.partnerName, state: st, latE2: s.partnerLatE2, lonE2: s.partnerLonE2, at: s.partnerLocAt)
    }

    var distance: DistanceModel {
        func none(_ state: String) -> DistanceModel {
            DistanceModel(state: state, km: nil, near: false, big: "–", unit: "km", sentence: "", ageText: nil, stale: false)
        }
        guard let s = snapshot, !feedRevoked else { return none("unpaired") }
        let partner = partnerLoc
        if !(s.paired ?? false) && partner == nil { return none("unpaired") }
        if !(s.shareMine ?? false) { return none("mine_off") }
        guard let p = partner else { return none("none") }
        if p.state == "hidden" { return none("hidden") }
        if p.state == "mine_off" { return none("mine_off") }
        guard p.state == "ok", let pl = p.latE2, let po = p.lonE2, let ml = s.myLatE2, let mo = s.myLonE2 else { return none("none") }
        let v = distanceView(haversineKm(ml, mo, pl, po))
        let at = p.at ?? 0
        return DistanceModel(
            state: "ok", km: v.km, near: v.near, big: v.big, unit: v.unit, sentence: v.sentence,
            ageText: at > 0 ? WS.distUpdated(agoIt(date.timeIntervalSince1970 - at / 1000)) : nil,
            stale: at > 0 && nowMs - at > GeoRules.locStaleMs
        )
    }
}

/// Voci della timeline del biglietto: adesso, ogni 10 min (il "12 min fa" cambia) fino alla scadenza e UN ATTIMO DOPO la
/// scadenza (il widget torna vuoto anche con l'app chiusa e senza rete).
func noteTimelineDates(now: Date, expiresAtMs: Double?) -> [Date] {
    var out: [Date] = [now]
    if let ms = expiresAtMs, ms > 0 {
        let exp = Date(timeIntervalSince1970: ms / 1000)
        if exp > now {
            var t = now.addingTimeInterval(600)
            while t < exp && out.count < 8 {
                out.append(t)
                t = t.addingTimeInterval(600)
            }
            out.append(exp.addingTimeInterval(1))
        }
    }
    return out
}

/// Voci della timeline della distanza: adesso, ogni ora per 6 h ("aggiornata 3 h fa" cambia) e l'istante in cui la
/// posizione di lei diventa "vecchia" (3 h).
func distanceTimelineDates(now: Date, partnerAtMs: Double?) -> [Date] {
    var out: [Date] = [now]
    for i in 1...6 { out.append(now.addingTimeInterval(Double(i) * 3600)) }
    if let ms = partnerAtMs, ms > 0 {
        let d = Date(timeIntervalSince1970: (ms + GeoRules.locStaleMs) / 1000 + 1)
        if d > now && d <= now.addingTimeInterval(24 * 3600) { out.append(d) }
    }
    return out.sorted()
}
