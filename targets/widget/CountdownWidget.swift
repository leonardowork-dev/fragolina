import SwiftUI
import WidgetKit

// "Manca poco": il numero grande dei giorni (o delle ore, nell'ultimo giorno) che mancano all'evento in primo piano,
// il titolo e la data. Il widget sceglie l'evento e calcola da solo i giorni dalla data (come "Giorni insieme"): scatta a
// mezzanotte e all'ora dell'evento anche con l'app chiusa. Il giorno dell'evento: variante festa con coriandoli statici.
// Dati: snapshot (Percorso A) e feed (Percorso B: così compare anche un evento creato dall'altra persona). Tocco: lista in app.

// MARK: - Simboli (tracciati in EventIcons.swift, generato da src/lib/countdown/icons.json)

enum EventSvg {
    /// Legge solo M L C Z assoluti (i simboli nostri non usano altro).
    static func path(_ d: String) -> Path {
        var spaced = ""
        for ch in d {
            if ch.isLetter { spaced += " \(ch) " } else { spaced.append(ch) }
        }
        let tokens = spaced.split(whereSeparator: { $0 == " " || $0 == "," }).map(String.init)
        var p = Path()
        var i = 0
        func num() -> CGFloat {
            defer { i += 1 }
            return i < tokens.count ? CGFloat(Double(tokens[i]) ?? 0) : 0
        }
        while i < tokens.count {
            let t = tokens[i]
            i += 1
            switch t {
            case "M":
                let x = num(), y = num()
                p.move(to: CGPoint(x: x, y: y))
            case "L":
                let x = num(), y = num()
                p.addLine(to: CGPoint(x: x, y: y))
            case "C":
                let x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num()
                p.addCurve(to: CGPoint(x: x, y: y), control1: CGPoint(x: x1, y: y1), control2: CGPoint(x: x2, y: y2))
            case "Z":
                p.closeSubpath()
            default:
                break
            }
        }
        return p
    }

    static func color(_ name: String) -> Color? {
        switch name {
        case "strawberry": return P.strawberry
        case "butter": return P.butter
        case "sky": return P.sky
        case "leaf": return P.leaf
        case "blush": return P.blush
        case "paper": return P.paper
        case "ink": return P.ink
        default: return nil
        }
    }
}

/// Un simbolo adesivo: forme piene con contorno inchiostro (stesso tratto delle altre icone).
struct EventIconView: View {
    let id: String
    var size: CGFloat = 32

    var body: some View {
        let shapes = EventIconData.shapes[id] ?? EventIconData.shapes["star"] ?? []
        Canvas { ctx, sz in
            let k = sz.width / 100
            var g = ctx
            g.scaleBy(x: k, y: k)
            for s in shapes {
                let path = EventSvg.path(s.d)
                if let c = EventSvg.color(s.fill) { g.fill(path, with: .color(c)) }
                g.stroke(path, with: .color(P.ink), style: StrokeStyle(lineWidth: 5.5, lineCap: .round, lineJoin: .round))
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - Testi

private extension FragolinaEntry {
    var cdParty: Bool {
        guard let c = countdown else { return false }
        return c.view.state == .today || c.view.state == .now
    }
    /// "oggi" / "ora!" in grande al posto del numero.
    var cdPartyWord: String { countdown?.view.state == .now ? WS.cdNow : WS.cdToday }
}

// MARK: - Viste

struct CountdownSmallView: View {
    let entry: FragolinaEntry

    var body: some View {
        if let c = entry.countdown {
            ZStack(alignment: .topTrailing) {
                EventIconView(id: c.icon, size: 34)
                VStack(alignment: .leading, spacing: 0) {
                    Spacer(minLength: 0)
                    if entry.cdParty {
                        Text(entry.cdPartyWord).font(display(34)).tracking(-0.8).foregroundStyle(P.ink)
                            .lineLimit(1).minimumScaleFactor(0.4)
                    } else {
                        Text(c.view.big).font(display(48)).tracking(-1.5).foregroundStyle(P.ink)
                            .lineLimit(1).minimumScaleFactor(0.4)
                        Text(c.view.unit).font(bodyFont(14, .heavy)).foregroundStyle(P.ink).lineLimit(1)
                    }
                    Text(c.title).font(bodyFont(13, .heavy)).foregroundStyle(P.ink)
                        .lineLimit(2).minimumScaleFactor(0.75).padding(.top, 2)
                    Text(c.dateLine).font(bodyFont(10, .semibold)).foregroundStyle(P.ink)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
            }
            .widgetURL(WidgetLink.countdown)
            .accessibilityElement(children: .combine)
        }
    }
}

struct CountdownMediumView: View {
    let entry: FragolinaEntry

    var body: some View {
        if let c = entry.countdown {
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 0) {
                    Spacer(minLength: 0)
                    if entry.cdParty {
                        Text(entry.cdPartyWord).font(display(46)).tracking(-1.2).foregroundStyle(P.ink)
                            .lineLimit(1).minimumScaleFactor(0.4)
                        Text(WS.cdPartyLine).font(bodyFont(13, .semibold)).foregroundStyle(P.ink).lineLimit(2)
                    } else {
                        Text(c.view.big).font(display(58)).tracking(-1.8).foregroundStyle(P.ink)
                            .lineLimit(1).minimumScaleFactor(0.4)
                        Text(c.view.unit).font(bodyFont(16, .heavy)).foregroundStyle(P.ink).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                StickerBox(fill: entry.cdParty ? P.strawberry : P.butter, radius: 22, offset: 4, rotation: 1.5) {
                    VStack(alignment: .leading, spacing: 2) {
                        EventIconView(id: c.icon, size: 28)
                        Text(c.title).font(display(18)).tracking(-0.3).foregroundStyle(P.ink)
                            .lineLimit(2).minimumScaleFactor(0.55)
                        Text(c.dateLine).font(bodyFont(11, .semibold)).foregroundStyle(P.ink)
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                    .padding(9)
                    .frame(width: 132, alignment: .leading)
                }
            }
            .widgetURL(WidgetLink.countdown)
            .accessibilityElement(children: .combine)
        }
    }
}

/// Nessun evento: fragola che dorme e un invito gentile.
struct CountdownEmptyView: View {
    let compact: Bool

    var body: some View {
        Group {
            if compact {
                VStack(alignment: .leading, spacing: 4) {
                    MascotView(sleeping: true, size: 58)
                    Spacer(minLength: 0)
                    Text(WS.cdEmptyTitle).font(display(19)).foregroundStyle(P.ink).minimumScaleFactor(0.6).lineLimit(2)
                    Text(WS.cdEmptySub).font(bodyFont(12, .semibold)).foregroundStyle(P.ink).lineLimit(2).minimumScaleFactor(0.85)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            } else {
                HStack(spacing: 16) {
                    MascotView(sleeping: true, size: 92)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(WS.cdEmptyTitle).font(display(26)).foregroundStyle(P.ink).minimumScaleFactor(0.6).lineLimit(2)
                        Text(WS.cdEmptySub).font(bodyFont(14, .semibold)).foregroundStyle(P.ink).lineLimit(2).minimumScaleFactor(0.85)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .widgetURL(WidgetLink.countdown)
    }
}

/// Schermata di blocco: cerchio (numero + unità) e riga singola ("12 giorni: Ci vediamo"), monocromatici.
struct CountdownLockView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        let c = entry.countdown
        Group {
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Image(systemName: "heart.fill").font(.system(size: 10))
                        if let c, !c.view.big.isEmpty {
                            Text(c.view.big).font(.system(size: 20, weight: .heavy, design: .rounded)).minimumScaleFactor(0.4).lineLimit(1)
                            Text(c.view.unit).font(.system(size: 9, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
                        } else {
                            Text(c != nil ? "!" : "–").font(.system(size: 22, weight: .heavy, design: .rounded))
                        }
                    }
                    .padding(.horizontal, 5)
                }
            default:
                if let c {
                    Label(c.view.big.isEmpty ? WS.cdInlinePlain(c.view.unit, c.title) : WS.cdInline(c.view.big, c.view.unit, c.title),
                          systemImage: "heart.fill")
                } else {
                    Label(WS.cdLockEmpty, systemImage: "heart")
                }
            }
        }
        .widgetURL(WidgetLink.countdown)
        .accessoryWidgetBackgroundCompat()
    }
}

struct CountdownWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        switch family {
        case .accessoryCircular, .accessoryInline:
            CountdownLockView(entry: entry)
        case .systemMedium:
            Group {
                if entry.state == .empty || entry.state == .unpaired {
                    SleepyView(entry: entry, compact: false)
                } else if entry.countdown == nil {
                    CountdownEmptyView(compact: false)
                } else {
                    CountdownMediumView(entry: entry)
                }
            }
            .stickerWidgetBackground(confetti: entry.cdParty, renew: entry.renewLastDay)
        default:
            Group {
                if entry.state == .empty || entry.state == .unpaired {
                    SleepyView(entry: entry, compact: true)
                } else if entry.countdown == nil {
                    CountdownEmptyView(compact: true)
                } else {
                    CountdownSmallView(entry: entry)
                }
            }
            .stickerWidgetBackground(confetti: entry.cdParty, renew: entry.renewLastDay)
        }
    }
}

struct CountdownWidget: Widget {
    let kind = "FragolinaCountdown"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CountdownProvider()) { entry in
            CountdownWidgetView(entry: entry)
        }
        .configurationDisplayName(WS.cdGalleryName)
        .description(WS.cdGalleryDesc)
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryInline])
    }
}
