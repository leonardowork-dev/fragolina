import SwiftUI
import WidgetKit

// MARK: - Dati condivisi (JSON scritto dall'app, schema in src/lib/widgetPayload.ts e tests/fixtures/widget-snapshot.json)

/// Tutti i campi sono opzionali: un payload vecchio (v1) o incompleto si legge comunque, mai un crash.
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
}

struct FragolinaEntry: TimelineEntry {
    let date: Date
    let snapshot: Snapshot?
    let group: String?          // gruppo risolto (diagnostica)
}

private let hardStaleAfter: TimeInterval = 48 * 3600   // oltre: la fragola dorme
private let softStaleAfter: TimeInterval = 3 * 3600    // oltre: "aggiornato X fa"

/// "adesso", "5 min fa", "3 h fa", "ieri", "4 giorni fa" (stesse soglie di timeAgo in src/lib/time.ts).
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
    /// "aggiornato 5 h fa"
    var updatedText: String { "aggiornato " + agoIt(age ?? 0) }
    /// "5 h", "2 g" (per i riquadri stretti)
    var ageShort: String {
        let a = age ?? 0
        if a < 3600 { return "\(max(1, Int(a / 60))) min" }
        if a < 86400 { return "\(Int(a / 3600)) h" }
        return "\(Int(a / 86400)) g"
    }
    /// nil se la data d'inizio non è ancora stata scelta.
    var daysValue: Int? {
        guard let s = snapshot?.startDate, !s.isEmpty else { return nil }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        guard let start = f.date(from: s) else { return nil }
        let cal = Calendar.current
        let d = cal.dateComponents([.day], from: cal.startOfDay(for: start), to: cal.startOfDay(for: date)).day ?? 0
        return max(0, d)
    }
    var daysText: String { daysValue.map { String($0) } ?? "–" }
    var partner: String { snapshot?.partnerName ?? "Lei" }
    var moodId: String? { snapshot?.moodId }
    var moodLabel: String { snapshot?.moodLabel ?? "" }
    var thoughts: Int { snapshot?.thinkingToday ?? 0 }
    /// "Ultimo da Nikole: 3 h fa"
    var lastPingText: String? {
        guard let ms = snapshot?.lastPingAt else { return nil }
        return "Ultimo da \(partner): " + agoIt(date.timeIntervalSince1970 - ms / 1000)
    }
}

// MARK: - Provider

struct FragolinaProvider: TimelineProvider {
    func placeholder(in context: Context) -> FragolinaEntry {
        FragolinaEntry(
            date: Date(),
            snapshot: Snapshot(v: 2, updatedAt: Date().timeIntervalSince1970 * 1000, paired: true, partnerName: "Nikole", moodId: "innamorata", moodLabel: "Innamorata", moodAt: nil, thinkingToday: 3, pingsReceived: 41, lastPingAt: Date().timeIntervalSince1970 * 1000 - 3 * 3600 * 1000, startDate: "2025-02-14"),
            group: nil
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (FragolinaEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : load(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FragolinaEntry>) -> Void) {
        let now = Date()
        let base = load(at: now)
        // Una voce ogni 30 minuti per 6 ore (così "aggiornato X fa" e la fragola che dorme avanzano da soli)
        // più una subito dopo mezzanotte (il contatore dei giorni scatta anche con l'app chiusa).
        var dates: [Date] = (0..<12).map { now.addingTimeInterval(Double($0) * 30 * 60) }
        if let midnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0, minute: 1), matchingPolicy: .nextTime) {
            dates.append(midnight)
        }
        dates.sort()
        let entries = dates.map { FragolinaEntry(date: $0, snapshot: base.snapshot, group: base.group) }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(30 * 60))))
    }

    private func load(at date: Date) -> FragolinaEntry {
        let group = GroupResolver.resolve()
        var snap: Snapshot?
        if let group,
           let raw = UserDefaults(suiteName: group)?.string(forKey: GroupResolver.payloadKey),
           let data = raw.data(using: .utf8) {
            snap = try? JSONDecoder().decode(Snapshot.self, from: data)
        }
        return FragolinaEntry(date: date, snapshot: snap, group: group)
    }
}

// MARK: - Viste

struct SleepyView: View {
    let entry: FragolinaEntry
    let compact: Bool

    var body: some View {
        let title = entry.isEmpty ? "Ancora niente" : (entry.isPaired ? "Dorme da un po'" : "Manca una persona")
        let sub = entry.isEmpty ? "Apri Fragolina una volta." : (entry.isPaired ? "Apri Fragolina per svegliarla." : "Collegati da Fragolina.")
        if compact {
            VStack(alignment: .leading, spacing: 4) {
                SleepyStrawberry(size: 62)
                Spacer(minLength: 0)
                Text(title).font(display(20)).foregroundStyle(P.ink).minimumScaleFactor(0.7).lineLimit(2)
                Text(sub).font(bodyFont(12, .semibold)).foregroundStyle(P.ink).lineLimit(2)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        } else {
            HStack(spacing: 16) {
                SleepyStrawberry(size: 96)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(display(28)).foregroundStyle(P.ink).minimumScaleFactor(0.7).lineLimit(2)
                    Text(sub).font(bodyFont(14, .semibold)).foregroundStyle(P.ink).lineLimit(2)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

/// Faccia dell'umore di lei; se non l'ha ancora scelto, un adesivo con il punto interrogativo.
struct MoodOrPlaceholder: View {
    let moodId: String?
    let size: CGFloat

    var body: some View {
        if let moodId {
            MoodFace(moodId: moodId, size: size)
        } else {
            ZStack {
                Circle().fill(P.skySoft)
                Circle().stroke(P.ink, style: StrokeStyle(lineWidth: 2.5, dash: [4, 4]))
                Text("?").font(display(size * 0.55)).foregroundStyle(P.ink)
            }
            .frame(width: size, height: size)
        }
    }
}

struct SmallView: View {
    let entry: FragolinaEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                StickerBox(fill: P.paper, radius: 32, offset: 3, rotation: -3) {
                    MoodOrPlaceholder(moodId: entry.moodId, size: 52).padding(2)
                }
                Spacer(minLength: 0)
                if entry.isSoftStale {
                    // Dati un po' vecchi: al posto dei pensieri compare da quanto tempo sono fermi.
                    StickerBox(fill: P.butter, radius: 14, offset: 2, rotation: 2) {
                        HStack(spacing: 3) {
                            Image(systemName: "clock").font(.system(size: 10, weight: .black))
                            Text(entry.ageShort).font(bodyFont(12, .heavy))
                        }
                        .foregroundStyle(P.ink)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                    }
                } else {
                    StickerBox(fill: P.strawberry, radius: 14, offset: 2, rotation: 2) {
                        HStack(spacing: 3) {
                            Image(systemName: "heart.fill").font(.system(size: 10, weight: .black))
                            Text("\(entry.thoughts)").font(display(15))
                        }
                        .foregroundStyle(P.ink)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                    }
                }
            }
            Spacer(minLength: 2)
            Text(entry.daysText)
                .font(display(46)).tracking(-1.4)
                .foregroundStyle(P.ink)
                .minimumScaleFactor(0.5).lineLimit(1)
            Text(entry.daysValue == nil ? "scegli la data" : "giorni insieme")
                .font(bodyFont(12, .heavy)).foregroundStyle(P.ink)
                .minimumScaleFactor(0.7).lineLimit(1)
        }
    }
}

struct MediumView: View {
    let entry: FragolinaEntry

    var body: some View {
        HStack(spacing: 14) {
            StickerBox(fill: P.butter, radius: 22, offset: 4, rotation: -1.5) {
                VStack(spacing: 4) {
                    MoodOrPlaceholder(moodId: entry.moodId, size: 66)
                    Text(entry.partner).font(bodyFont(13, .heavy)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.7)
                    Text(entry.moodId == nil ? "ancora niente" : entry.moodLabel).font(bodyFont(11, .semibold)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.6)
                }
                .padding(.vertical, 10).padding(.horizontal, 10)
                .frame(width: 112)
            }
            VStack(alignment: .leading, spacing: 2) {
                Spacer(minLength: 0)
                Text(entry.daysText)
                    .font(display(52)).tracking(-1.6)
                    .foregroundStyle(P.ink)
                    .minimumScaleFactor(0.5).lineLimit(1)
                Text(entry.daysValue == nil ? "scegli la data in Fragolina" : "giorni insieme")
                    .font(bodyFont(14, .heavy)).foregroundStyle(P.ink)
                    .minimumScaleFactor(0.7).lineLimit(1)
                Spacer(minLength: 4)
                StickerBox(fill: P.strawberry, radius: 14, offset: 2, rotation: 1) {
                    HStack(spacing: 5) {
                        Image(systemName: "heart.fill").font(.system(size: 11, weight: .black))
                        Text(entry.thoughts == 1 ? "Tu: 1 oggi" : "Tu: \(entry.thoughts) oggi")
                            .font(bodyFont(12, .heavy))
                    }
                    .foregroundStyle(P.ink)
                    .padding(.horizontal, 9).padding(.vertical, 5)
                }
                // Riga di contesto: dati vecchi => da quanto; altrimenti l'ultimo pensiero di lei.
                if entry.isSoftStale {
                    Text(entry.updatedText)
                        .font(bodyFont(11, .semibold)).foregroundStyle(P.ink)
                        .lineLimit(1).minimumScaleFactor(0.7)
                } else if let last = entry.lastPingText {
                    Text(last)
                        .font(bodyFont(11, .semibold)).foregroundStyle(P.ink)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct AccessoryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Image(systemName: "heart.fill").font(.system(size: 11))
                    Text(entry.daysText).font(.system(size: 18, weight: .black, design: .rounded)).minimumScaleFactor(0.6)
                }
            }
        case .accessoryInline:
            Text("♥ \(entry.thoughts) · \(entry.daysText) giorni")
        default:
            VStack(alignment: .leading, spacing: 1) {
                Text(entry.daysValue == nil ? "Scegli la data" : "\(entry.daysText) giorni insieme").font(.system(size: 15, weight: .black, design: .rounded))
                Text(entry.moodId == nil ? "\(entry.partner): ancora niente" : "\(entry.partner): \(entry.moodLabel)").font(.system(size: 12, weight: .semibold))
                if entry.isSoftStale {
                    Text(entry.updatedText).font(.system(size: 12, weight: .semibold))
                } else {
                    Text(entry.thoughts == 1 ? "♥ 1 pensiero oggi" : "♥ \(entry.thoughts) pensieri oggi").font(.system(size: 12, weight: .semibold))
                }
            }
        }
    }
}

/// Sfondo del widget. iOS 17+: `containerBackground` (margini automatici). iOS 16: stesso sfondo piatto "carta"
/// a pieno riquadro con margine interno fatto a mano (su iOS 16 il sistema non mette margini).
struct StickerWidgetBackground: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(P.paper, for: .widget)
        } else {
            content
                .padding(16)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(P.paper)
        }
    }
}

/// Schermata di blocco: iOS 17+ pretende comunque `containerBackground` (altrimenti mostra un segnaposto);
/// iOS 16 non ne ha bisogno. Sfondo trasparente: ci pensa il sistema.
struct AccessoryBackgroundCompat: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(Color.clear, for: .widget)
        } else {
            content
        }
    }
}

extension View {
    func accessoryWidgetBackgroundCompat() -> some View { modifier(AccessoryBackgroundCompat()) }
    func stickerWidgetBackground() -> some View { modifier(StickerWidgetBackground()) }
}

struct FragolinaWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        switch family {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            AccessoryView(entry: entry).accessoryWidgetBackgroundCompat()
        case .systemMedium:
            Group {
                if entry.isEmpty || !entry.isPaired || entry.isHardStale { SleepyView(entry: entry, compact: false) } else { MediumView(entry: entry) }
            }
            .stickerWidgetBackground()
        default:
            Group {
                if entry.isEmpty || !entry.isPaired || entry.isHardStale { SleepyView(entry: entry, compact: true) } else { SmallView(entry: entry) }
            }
            .stickerWidgetBackground()
        }
    }
}

struct FragolinaWidget: Widget {
    let kind = "FragolinaWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FragolinaProvider()) { entry in
            FragolinaWidgetView(entry: entry)
        }
        .configurationDisplayName("Fragolina")
        .description("L'umore di lei, i pensieri, i giorni insieme.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
