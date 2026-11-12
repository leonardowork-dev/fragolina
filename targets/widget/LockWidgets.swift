import SwiftUI
import WidgetKit

// Schermata di blocco (iOS 16+): accessoryCircular / accessoryRectangular / accessoryInline.
// Tutto monocromatico: niente colori della palette, solo `.primary` e il fondo di sistema, così si legge in "vibrant".
// Niente emoji: simboli SF e testo.

private extension FragolinaEntry {
    var lockNextLine: String? {
        guard let r = recurrence else { return nil }
        return WS.nextInline(untilText(r.daysUntil), r.label)
    }
    var lockDaysWith: String {
        guard let d = daysValue else { return WS.daysPick }
        return d == 1 ? WS.lockDaysWithOne(partner) : WS.lockDaysWith(String(d), partner)
    }
}

// ---------- Noi: giorni insieme ----------

struct LockDaysView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Image(systemName: "heart.fill").font(.system(size: 10))
                        Text(entry.daysText)
                            .font(.system(size: 21, weight: .heavy, design: .rounded))
                            .minimumScaleFactor(0.45).lineLimit(1)
                        Text("giorni").font(.system(size: 9, weight: .bold))
                    }
                    .padding(.horizontal, 5)
                }
            case .accessoryInline:
                Label(entry.lockDaysWith, systemImage: "heart.fill")
            default:
                VStack(alignment: .leading, spacing: 1) {
                    Text(entry.lockDaysWith)
                        .font(.system(size: 15, weight: .heavy, design: .rounded))
                        .lineLimit(1).minimumScaleFactor(0.65)
                    if let line = entry.lockNextLine {
                        Text(line).font(.system(size: 12, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    Text(entry.isSoftStale
                         ? entry.updatedText
                         : (entry.moodId == nil ? WS.a11yMood(entry.partner, WS.moodNone) : WS.a11yMood(entry.partner, entry.moodLabel)))
                        .font(.system(size: 12, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .widgetURL(WidgetLink.home)
        .accessoryWidgetBackgroundCompat()
    }
}

struct LockDaysGate: View {
    let entry: FragolinaEntry
    var body: some View {
        if entry.state == .ok { LockDaysView(entry: entry) } else { LockSleepy(entry: entry) }
    }
}

struct LockWidget: Widget {
    let kind = "FragolinaLock"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FragolinaProvider()) { entry in
            LockDaysGate(entry: entry)
        }
        .configurationDisplayName(WS.lockName)
        .description(WS.lockDesc)
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

// ---------- Umore di lei ----------

struct LockMoodView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    LockMoodGlyph(moodId: entry.moodId, size: 44)
                }
            case .accessoryInline:
                Label(entry.moodId == nil ? WS.a11yMood(entry.partner, WS.moodNone) : WS.a11yMood(entry.partner, entry.moodLabel), systemImage: "heart.fill")
            default:
                HStack(spacing: 8) {
                    LockMoodGlyph(moodId: entry.moodId, size: 38)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(entry.partner).font(.system(size: 14, weight: .heavy, design: .rounded)).lineLimit(1).minimumScaleFactor(0.7)
                        Text(entry.moodId == nil ? WS.moodNone : entry.moodLabel)
                            .font(.system(size: 13, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7)
                        if entry.isSoftStale {
                            Text(entry.updatedText).font(.system(size: 11, weight: .semibold)).lineLimit(1)
                        } else {
                            Label(WS.lockPings(entry.received), systemImage: "heart.fill")
                                .font(.system(size: 11, weight: .semibold)).lineLimit(1)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .widgetURL(WidgetLink.home)
        .accessoryWidgetBackgroundCompat()
    }
}

struct LockMoodGate: View {
    let entry: FragolinaEntry
    var body: some View {
        if entry.state == .ok { LockMoodView(entry: entry) } else { LockSleepy(entry: entry) }
    }
}

struct LockMoodWidget: Widget {
    let kind = "FragolinaLockMood"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FragolinaProvider()) { entry in
            LockMoodGate(entry: entry)
        }
        .configurationDisplayName(WS.lockMoodName)
        .description(WS.lockMoodDesc)
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
