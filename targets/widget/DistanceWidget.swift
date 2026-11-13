import SwiftUI
import WidgetKit

// "Distanza tra noi": il numero grande ("342 km") con una piccola fragola e un cuore, e "aggiornata X fa".
// Si vede solo se la condividete tutti e due; altrimenti uno stato gentile (nascosta / la tua è spenta / non ancora).
// La mia posizione viene dallo snapshot (App Group), quella di lei dal feed (Percorso B). Tocco: scheda Noi.

/// Cuore adesivo: riempimento fragola, contorno inchiostro (disegnato con il percorso del cuore già in Faces.swift).
struct HeartSticker: View {
    var size: CGFloat = 22

    var body: some View {
        Canvas { ctx, sz in
            let k = sz.width / 28
            var g = ctx
            g.scaleBy(x: k, y: k)
            let h = heartPath(14, 13, 1.35)
            g.fill(h, with: .color(P.strawberry))
            g.stroke(h, with: .color(P.ink), style: StrokeStyle(lineWidth: 2.4, lineJoin: .round))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

private extension FragolinaEntry {
    var distStateTitle: String {
        switch distance.state {
        case "hidden": return WS.distHidden
        case "mine_off": return WS.distMineOff
        case "none": return WS.distNone
        default: return WS.distUnpaired
        }
    }
    var distStateSub: String {
        switch distance.state {
        case "hidden": return WS.distHiddenSub(partner)
        case "mine_off": return WS.distMineOffSub
        case "none": return WS.distNoneSub(partner)
        default: return WS.distUnpairedSub
        }
    }
}

struct DistanceSmallView: View {
    let entry: FragolinaEntry

    var body: some View {
        let d = entry.distance
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 0) {
                MascotView(mood: d.state == "ok" ? "innamorata" : nil, sleeping: d.state != "ok", size: 36)
                Spacer(minLength: 0)
                HeartSticker(size: 22)
            }
            Spacer(minLength: 2)
            if d.state == "ok" {
                if d.near {
                    Text(WS.distNear).font(display(26)).tracking(-0.6).foregroundStyle(P.ink)
                        .lineLimit(1).minimumScaleFactor(0.4)
                } else {
                    Text(d.big).font(display(44)).tracking(-1.4).foregroundStyle(P.ink)
                        .lineLimit(1).minimumScaleFactor(0.35)
                    Text(d.unit).font(bodyFont(14, .heavy)).foregroundStyle(P.ink)
                }
                if let age = d.ageText {
                    Text(age).font(bodyFont(10, .semibold)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.7)
                }
            } else {
                Text(entry.distStateTitle).font(display(18)).foregroundStyle(P.ink).lineLimit(2).minimumScaleFactor(0.6)
                Text(entry.distStateSub).font(bodyFont(11, .semibold)).foregroundStyle(P.ink).lineLimit(3).minimumScaleFactor(0.8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(WidgetLink.us)
        .accessibilityElement(children: .combine)
    }
}

struct DistanceMediumView: View {
    let entry: FragolinaEntry

    var body: some View {
        let d = entry.distance
        HStack(spacing: 14) {
            StickerBox(fill: d.state == "ok" ? P.blush : P.skySoft, radius: 22, offset: 4, rotation: -1.5) {
                MascotView(mood: d.state == "ok" ? "innamorata" : nil, sleeping: d.state != "ok", size: 76)
                    .padding(.horizontal, 10).padding(.vertical, 6)
            }
            VStack(alignment: .leading, spacing: 2) {
                if d.state == "ok" {
                    HStack(alignment: .lastTextBaseline, spacing: 6) {
                        if d.near {
                            Text(WS.distNear).font(display(34)).tracking(-0.8).foregroundStyle(P.ink)
                                .lineLimit(1).minimumScaleFactor(0.4)
                        } else {
                            Text(d.big).font(display(52)).tracking(-1.6).foregroundStyle(P.ink)
                                .lineLimit(1).minimumScaleFactor(0.35)
                            Text(d.unit).font(bodyFont(18, .heavy)).foregroundStyle(P.ink)
                        }
                        HeartSticker(size: 22)
                    }
                    if let age = d.ageText {
                        Text(age).font(bodyFont(12, .semibold)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.7)
                    }
                } else {
                    Text(entry.distStateTitle).font(display(24)).foregroundStyle(P.ink).lineLimit(2).minimumScaleFactor(0.6)
                    Text(entry.distStateSub).font(bodyFont(13, .semibold)).foregroundStyle(P.ink).lineLimit(3).minimumScaleFactor(0.8)
                }
            }
            Spacer(minLength: 0)
        }
        .widgetURL(WidgetLink.us)
        .accessibilityElement(children: .combine)
    }
}

/// Schermata di blocco: cerchio (cuore + numero + km) e riga singola ("a 342 km").
struct DistanceLockView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        let d = entry.distance
        Group {
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Image(systemName: "heart.fill").font(.system(size: 10))
                        if d.state == "ok" && !d.near {
                            Text(d.big).font(.system(size: 20, weight: .heavy, design: .rounded)).minimumScaleFactor(0.4).lineLimit(1)
                            Text(d.unit).font(.system(size: 9, weight: .bold))
                        } else {
                            Text(d.state == "ok" ? "0" : "–").font(.system(size: 20, weight: .heavy, design: .rounded))
                        }
                    }
                    .padding(.horizontal, 5)
                }
            default:
                Label(d.state == "ok" ? d.sentence : entry.distStateTitle, systemImage: "heart.fill")
            }
        }
        .widgetURL(WidgetLink.us)
        .accessoryWidgetBackgroundCompat()
    }
}

struct DistanceWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        switch family {
        case .accessoryCircular, .accessoryInline:
            DistanceLockView(entry: entry)
        case .systemMedium:
            DistanceMediumView(entry: entry).stickerWidgetBackground()
        default:
            DistanceSmallView(entry: entry).stickerWidgetBackground()
        }
    }
}

struct DistanceWidget: Widget {
    let kind = "FragolinaDistance"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DistanceProvider()) { entry in
            DistanceWidgetView(entry: entry)
        }
        .configurationDisplayName(WS.distGalleryName)
        .description(WS.distGalleryDesc)
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryInline])
    }
}
