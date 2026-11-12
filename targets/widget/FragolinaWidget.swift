import SwiftUI
import WidgetKit

// Widget "Fragolina" (kind "FragolinaWidget"): quello della sessione 1-2, tenuto con lo stesso kind così chi lo ha già
// sulla Home non lo perde. Riquadro piccolo/medio con umore di lei + giorni + pensieri; accessori = quelli di
// LockWidgets.swift. I widget nuovi (umore, penso a te, giorni, blocco) sono in file propri.

struct SmallView: View {
    let entry: FragolinaEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                StickerBox(fill: moodFill(entry.moodId), radius: 20, offset: 3, rotation: -3) {
                    MoodOrPlaceholder(moodId: entry.moodId, size: 34).padding(4)
                }
                Spacer(minLength: 0)
                if entry.isSoftStale {
                    StickerPill(text: entry.ageShort, fill: P.butter, size: 12, symbol: "clock", rotation: 2)
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
                .font(display(40)).tracking(-1.2)
                .foregroundStyle(P.ink)
                .minimumScaleFactor(0.4).lineLimit(1)
            Text(entry.daysValue == nil ? WS.daysPickHint : WS.daysLabel)
                .font(bodyFont(12, .heavy)).foregroundStyle(P.ink)
                .minimumScaleFactor(0.7).lineLimit(1)
        }
        .widgetURL(WidgetLink.home)
    }
}

struct MediumView: View {
    let entry: FragolinaEntry

    var body: some View {
        HStack(spacing: 14) {
            StickerBox(fill: moodFill(entry.moodId), radius: 22, offset: 4, rotation: -1.5) {
                VStack(spacing: 3) {
                    MoodOrPlaceholder(moodId: entry.moodId, size: 50)
                    Text(entry.partnerShort).font(bodyFont(12, .heavy)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.7)
                    Text(entry.moodId == nil ? WS.moodNone : entry.moodLabel).font(bodyFont(11, .semibold)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.6)
                }
                .padding(.vertical, 8).padding(.horizontal, 8)
                .frame(width: 112)
            }
            VStack(alignment: .leading, spacing: 2) {
                Spacer(minLength: 0)
                Text(entry.daysText)
                    .font(display(46)).tracking(-1.4)
                    .foregroundStyle(P.ink)
                    .minimumScaleFactor(0.4).lineLimit(1)
                Text(entry.daysValue == nil ? WS.daysPickHint : WS.daysLabel)
                    .font(bodyFont(14, .heavy)).foregroundStyle(P.ink)
                    .minimumScaleFactor(0.7).lineLimit(1)
                Spacer(minLength: 4)
                StickerPill(text: WS.pingYouToday(entry.thoughts), fill: P.strawberry, size: 12, symbol: "heart.fill", rotation: 1)
                if entry.isSoftStale {
                    Text(entry.updatedText).font(bodyFont(11, .semibold)).foregroundStyle(P.ink)
                        .lineLimit(1).minimumScaleFactor(0.7)
                } else if let last = entry.lastPingText {
                    Text(last).font(bodyFont(11, .semibold)).foregroundStyle(P.ink)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .widgetURL(WidgetLink.home)
    }
}

struct FragolinaWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        switch family {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            LockDaysGate(entry: entry)
        case .systemMedium:
            Group {
                if entry.state != .ok { SleepyView(entry: entry, compact: false) } else { MediumView(entry: entry) }
            }
            .stickerWidgetBackground()
        default:
            Group {
                if entry.state != .ok { SleepyView(entry: entry, compact: true) } else { SmallView(entry: entry) }
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
        .configurationDisplayName(WS.legacyName)
        .description(WS.legacyDesc)
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
