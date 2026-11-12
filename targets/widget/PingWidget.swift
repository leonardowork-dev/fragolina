import SwiftUI
import WidgetKit

// "Penso a te": il tocco apre l'app su fragolina://ping, che manda UN pensiero (src/lib/deepLink.ts).
// iOS 16 non ha widget interattivi: l'interazione è solo widgetURL / Link.

private struct PingLines: View {
    let entry: FragolinaEntry
    var size: CGFloat = 11
    var showName: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(showName ? WS.pingsFrom(entry.partnerShort) : WS.pingsReceived).font(bodyFont(size + 1, .heavy)).foregroundStyle(P.ink)
                .lineLimit(1).minimumScaleFactor(0.65)
            if entry.isSoftStale {
                Text(entry.updatedText).font(bodyFont(size, .semibold)).foregroundStyle(P.ink)
                    .lineLimit(1).minimumScaleFactor(0.7)
            } else {
                Text(entry.lastPingText ?? WS.pingNone).font(bodyFont(size, .semibold)).foregroundStyle(P.ink)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
        }
    }
}

struct PingSmallView: View {
    let entry: FragolinaEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text("\(entry.received)")
                    .font(display(40)).tracking(-1.2).foregroundStyle(P.ink)
                    .lineLimit(1).minimumScaleFactor(0.5)
                Image(systemName: "heart.fill")
                    .font(.system(size: 15, weight: .black)).foregroundStyle(P.strawberry)
            }
            PingLines(entry: entry, showName: false)
            Spacer(minLength: 2)
            StickerPill(text: WS.pingTap, fill: P.strawberry, size: 11, symbol: "heart.fill", rotation: -1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(WidgetLink.ping)
    }
}

struct PingMediumView: View {
    let entry: FragolinaEntry

    var body: some View {
        HStack(spacing: 14) {
            StickerBox(fill: P.strawberry, radius: 24, offset: 4, rotation: -1.5) {
                VStack(spacing: 4) {
                    Image(systemName: "heart.fill").font(.system(size: 26, weight: .black)).foregroundStyle(P.ink)
                    Text(WS.pingTitle).font(display(20)).foregroundStyle(P.ink)
                        .lineLimit(2).minimumScaleFactor(0.6).multilineTextAlignment(.center)
                    StickerPill(text: WS.pingTapShort, fill: P.butter, size: 11)
                }
                .padding(10)
                .frame(width: 118, height: 108)
            }
            VStack(alignment: .leading, spacing: 2) {
                Spacer(minLength: 0)
                Text("\(entry.received)")
                    .font(display(50)).tracking(-1.4).foregroundStyle(P.ink)
                    .lineLimit(1).minimumScaleFactor(0.5)
                PingLines(entry: entry, size: 12)
                Spacer(minLength: 2)
                Text(WS.pingYouToday(entry.thoughts)).font(bodyFont(12, .heavy)).foregroundStyle(P.ink)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .widgetURL(WidgetLink.ping)
    }
}

struct PingWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        let medium = family == .systemMedium
        Group {
            if entry.state != .ok {
                SleepyView(entry: entry, compact: !medium)
            } else if medium {
                PingMediumView(entry: entry)
            } else {
                PingSmallView(entry: entry)
            }
        }
        .stickerWidgetBackground()
    }
}

struct PingWidget: Widget {
    let kind = "FragolinaPing"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FragolinaProvider()) { entry in
            PingWidgetView(entry: entry)
        }
        .configurationDisplayName(WS.pingName)
        .description(WS.pingDesc)
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
