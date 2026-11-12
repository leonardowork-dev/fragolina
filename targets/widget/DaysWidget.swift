import SwiftUI
import WidgetKit

// "Giorni insieme": numero grande in Bagel Fat One + prossima ricorrenza. Il giorno della ricorrenza: variante festa
// con coriandoli statici (disegnati, nessuna animazione). Giorni e ricorrenza li calcola il widget da `startDate`.

private extension FragolinaEntry {
    var isParty: Bool { (recurrence?.daysUntil ?? 1) == 0 }
    var nextLine: String? {
        guard let r = recurrence else { return nil }
        return WS.nextInline(untilText(r.daysUntil), r.label)
    }
    var daysCaption: String { daysValue == 1 ? WS.daysLabelOne : WS.daysLabel }
}

struct DaysSmallView: View {
    let entry: FragolinaEntry

    var body: some View {
        ZStack(alignment: .topTrailing) {
            // la mascotte sta in un angolo, fuori dal flusso: non ruba altezza al numero
            MascotView(mood: entry.isParty ? "carica" : "innamorata", size: 32)
            texts
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
        }
        .widgetURL(WidgetLink.home)
    }

    private var texts: some View {
        VStack(alignment: .leading, spacing: 0) {
            if entry.daysValue == nil {
                Text(WS.daysPick).font(display(26)).foregroundStyle(P.ink).lineLimit(2).minimumScaleFactor(0.6)
                Text(WS.daysPickHint).font(bodyFont(12, .semibold)).foregroundStyle(P.ink).lineLimit(2).minimumScaleFactor(0.8)
            } else {
                Text(entry.daysText)
                    .font(display(46)).tracking(-1.4).foregroundStyle(P.ink)
                    .lineLimit(1).minimumScaleFactor(0.4)
                Text(entry.daysCaption).font(bodyFont(13, .heavy)).foregroundStyle(P.ink)
                    .lineLimit(1).minimumScaleFactor(0.7)
                if entry.isParty, let r = entry.recurrence {
                    StickerPill(text: WS.todayParty(r.label), fill: P.strawberry, size: 11, symbol: "heart.fill", rotation: -1)
                        .padding(.top, 3)
                } else if let line = entry.nextLine {
                    Text(line).font(bodyFont(11, .semibold)).foregroundStyle(P.ink)
                        .lineLimit(2).minimumScaleFactor(0.8).padding(.top, 1)
                }
            }
        }
    }
}

struct DaysMediumView: View {
    let entry: FragolinaEntry

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 0)
                if entry.daysValue == nil {
                    Text(WS.daysPick).font(display(34)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.6)
                    Text(WS.daysPickHint).font(bodyFont(13, .semibold)).foregroundStyle(P.ink).lineLimit(2)
                } else {
                    Text(entry.daysText)
                        .font(display(54)).tracking(-1.8).foregroundStyle(P.ink)
                        .lineLimit(1).minimumScaleFactor(0.4)
                    Text(entry.daysCaption).font(bodyFont(14, .heavy)).foregroundStyle(P.ink)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let r = entry.recurrence {
                StickerBox(fill: entry.isParty ? P.strawberry : P.butter, radius: 22, offset: 4, rotation: 1.5) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(entry.isParty ? WS.partyLine : WS.nextTitle)
                            .font(bodyFont(11, .heavy)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.7)
                        Text(r.label).font(display(22)).tracking(-0.4).foregroundStyle(P.ink)
                            .lineLimit(2).minimumScaleFactor(0.55)
                        Text(entry.isParty ? shortDate(r.date) : untilText(r.daysUntil) + " · " + shortDate(r.date))
                            .font(bodyFont(11, .semibold)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.7)
                    }
                    .padding(10)
                    .frame(width: 122, alignment: .leading)
                }
            } else {
                MascotView(mood: "innamorata", size: 74)
            }
        }
        .widgetURL(WidgetLink.home)
    }
}

struct DaysWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        let medium = family == .systemMedium
        Group {
            if entry.state != .ok {
                SleepyView(entry: entry, compact: !medium).stickerWidgetBackground()
            } else if medium {
                DaysMediumView(entry: entry).stickerWidgetBackground(confetti: entry.isParty)
            } else {
                DaysSmallView(entry: entry).stickerWidgetBackground(confetti: entry.isParty)
            }
        }
    }
}

struct DaysWidget: Widget {
    let kind = "FragolinaDays"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FragolinaProvider()) { entry in
            DaysWidgetView(entry: entry)
        }
        .configurationDisplayName(WS.daysName)
        .description(WS.daysDesc)
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
