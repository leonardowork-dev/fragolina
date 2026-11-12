import Foundation

// SOLO Foundation in questo file (niente SwiftUI/WidgetKit): si compila e si prova anche su Linux
// (scripts/swift-check.mjs), contro le stesse fixture di vitest.

// MARK: - Dati condivisi (JSON scritto dall'app: src/lib/widgetPayload.ts, fixture in tests/fixtures/)

/// Tutti i campi sono opzionali e si leggono uno per uno: un payload v1, v2, v3 o incompleto si legge comunque,
/// mai un crash; un campo del tipo sbagliato vale `nil` ma non butta via gli altri.
/// NOTA: i campi si AGGIUNGONO in fondo (v2 = prima parte, v3 = seconda). tests/widgetPayload.test.ts controlla
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
}

extension Snapshot {
    enum CodingKeys: String, CodingKey {
        case v, updatedAt, paired, partnerName, moodId, moodLabel, moodAt, thinkingToday, pingsReceived
        case lastPingAt, startDate, myName, myMoodId, myMoodLabel, myMoodAt
        case questionText, questionMineDone, questionBothDone
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
            questionBothDone: get(Bool.self, .questionBothDone)
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

// MARK: - Link dei widget (gestiti in app/+native-intent.ts e src/lib/deepLink.ts)

enum WidgetLink {
    static let ping = URL(string: "fragolina://ping")!
    static let mood = URL(string: "fragolina://mood")!
    static let us = URL(string: "fragolina://us")!
    static let home = URL(string: "fragolina://home")!
}
