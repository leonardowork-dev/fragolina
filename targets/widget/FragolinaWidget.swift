import SwiftUI
import WidgetKit

// MARK: - Dati condivisi (JSON scritto dall'app, schema in src/lib/widgetBridge.ts)

struct Snapshot: Codable {
    var v: Int?
    var updatedAt: Double?      // ms da epoch
    var partnerName: String?
    var moodId: String?
    var moodLabel: String?
    var thinkingToday: Int?
    var startDate: String?      // AAAA-MM-GG
}

struct FragolinaEntry: TimelineEntry {
    let date: Date
    let snapshot: Snapshot?
    let group: String?          // gruppo risolto (diagnostica)
}

private let staleAfter: TimeInterval = 48 * 3600

extension FragolinaEntry {
    var isEmpty: Bool { snapshot == nil }
    var isStale: Bool {
        guard let ms = snapshot?.updatedAt else { return false }
        return date.timeIntervalSince1970 - ms / 1000 > staleAfter
    }
    var days: Int {
        guard let s = snapshot?.startDate else { return 0 }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        guard let start = f.date(from: s) else { return 0 }
        let cal = Calendar.current
        let d = cal.dateComponents([.day], from: cal.startOfDay(for: start), to: cal.startOfDay(for: date)).day ?? 0
        return max(0, d)
    }
    var partner: String { snapshot?.partnerName ?? "Lei" }
    var mood: String { snapshot?.moodId ?? "felice" }
    var moodLabel: String { snapshot?.moodLabel ?? "" }
    var thoughts: Int { snapshot?.thinkingToday ?? 0 }
}

// MARK: - Provider

struct FragolinaProvider: TimelineProvider {
    func placeholder(in context: Context) -> FragolinaEntry {
        FragolinaEntry(
            date: Date(),
            snapshot: Snapshot(v: 1, updatedAt: Date().timeIntervalSince1970 * 1000, partnerName: "Nikole", moodId: "innamorata", moodLabel: "Innamorata", thinkingToday: 3, startDate: "2025-02-14"),
            group: nil
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (FragolinaEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : load(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FragolinaEntry>) -> Void) {
        let now = Date()
        // Due voci: adesso e subito dopo mezzanotte, così il contatore dei giorni scatta da solo.
        let midnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0, minute: 1), matchingPolicy: .nextTime) ?? now.addingTimeInterval(3600)
        let entries = [load(at: now), load(at: midnight)]
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
        let title = entry.isEmpty ? "Ancora niente" : "Dorme da un po'"
        let sub = entry.isEmpty ? "Apri Fragolina una volta." : "Apri Fragolina per svegliarla."
        if compact {
            VStack(alignment: .leading, spacing: 4) {
                SleepyStrawberry(size: 62)
                Spacer(minLength: 0)
                Text(title).font(display(20)).foregroundStyle(P.ink).minimumScaleFactor(0.7).lineLimit(2)
                Text(sub).font(body(12, .semibold)).foregroundStyle(P.ink).lineLimit(2)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        } else {
            HStack(spacing: 16) {
                SleepyStrawberry(size: 96)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(display(28)).foregroundStyle(P.ink).minimumScaleFactor(0.7).lineLimit(2)
                    Text(sub).font(body(14, .semibold)).foregroundStyle(P.ink).lineLimit(2)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

struct SmallView: View {
    let entry: FragolinaEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                StickerBox(fill: P.paper, radius: 32, offset: 3, rotation: -3) {
                    MoodFace(moodId: entry.mood, size: 52).padding(2)
                }
                Spacer(minLength: 0)
                StickerBox(fill: P.strawberry, radius: 14, offset: 2, rotation: 2) {
                    HStack(spacing: 3) {
                        Image(systemName: "heart.fill").font(.system(size: 10, weight: .black))
                        Text("\(entry.thoughts)").font(display(15))
                    }
                    .foregroundStyle(P.ink)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                }
            }
            Spacer(minLength: 2)
            Text("\(entry.days)")
                .font(display(46)).tracking(-1.4)
                .foregroundStyle(P.ink)
                .minimumScaleFactor(0.5).lineLimit(1)
            Text("giorni insieme").font(body(12, .heavy)).foregroundStyle(P.ink)
        }
    }
}

struct MediumView: View {
    let entry: FragolinaEntry

    var body: some View {
        HStack(spacing: 14) {
            StickerBox(fill: P.butter, radius: 22, offset: 4, rotation: -1.5) {
                VStack(spacing: 4) {
                    MoodFace(moodId: entry.mood, size: 66)
                    Text(entry.partner).font(body(13, .heavy)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.7)
                    Text(entry.moodLabel).font(body(11, .semibold)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.6)
                }
                .padding(.vertical, 10).padding(.horizontal, 10)
                .frame(width: 112)
            }
            VStack(alignment: .leading, spacing: 2) {
                Spacer(minLength: 0)
                Text("\(entry.days)")
                    .font(display(56)).tracking(-1.8)
                    .foregroundStyle(P.ink)
                    .minimumScaleFactor(0.5).lineLimit(1)
                Text("giorni insieme").font(body(14, .heavy)).foregroundStyle(P.ink)
                Spacer(minLength: 6)
                StickerBox(fill: P.strawberry, radius: 14, offset: 2, rotation: 1) {
                    HStack(spacing: 5) {
                        Image(systemName: "heart.fill").font(.system(size: 11, weight: .black))
                        Text(entry.thoughts == 1 ? "1 pensiero oggi" : "\(entry.thoughts) pensieri oggi")
                            .font(body(12, .heavy))
                    }
                    .foregroundStyle(P.ink)
                    .padding(.horizontal, 9).padding(.vertical, 5)
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
                    Text("\(entry.days)").font(.system(size: 18, weight: .black, design: .rounded)).minimumScaleFactor(0.6)
                }
            }
        case .accessoryInline:
            Text("♥ \(entry.thoughts) · \(entry.days) giorni")
        default:
            VStack(alignment: .leading, spacing: 1) {
                Text("\(entry.days) giorni insieme").font(.system(size: 15, weight: .black, design: .rounded))
                Text("\(entry.partner): \(entry.moodLabel)").font(.system(size: 12, weight: .semibold))
                Text(entry.thoughts == 1 ? "♥ 1 pensiero oggi" : "♥ \(entry.thoughts) pensieri oggi").font(.system(size: 12, weight: .semibold))
            }
        }
    }
}

struct FragolinaWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        switch family {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            AccessoryView(entry: entry)
        case .systemMedium:
            Group {
                if entry.isEmpty || entry.isStale { SleepyView(entry: entry, compact: false) } else { MediumView(entry: entry) }
            }
            .containerBackground(P.paper, for: .widget)
        default:
            Group {
                if entry.isEmpty || entry.isStale { SleepyView(entry: entry, compact: true) } else { SmallView(entry: entry) }
            }
            .containerBackground(P.paper, for: .widget)
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
        .description("L'umore di lei, i pensieri di oggi, i giorni insieme.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
