import SwiftUI
import WidgetKit

// Pezzi comuni a tutti i widget: sfondi, stato "dorme", scelta del link, righe di testo.

/// Sfondo del widget. iOS 17+: `containerBackground` (margini automatici). iOS 16: stesso sfondo piatto "carta"
/// a pieno riquadro con margine interno fatto a mano (su iOS 16 il sistema non mette margini).
/// `confetti`: coriandoli statici dietro al contenuto (giorno di festa).
struct StickerWidgetBackground: ViewModifier {
    var confetti: Bool = false

    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(for: .widget) {
                ZStack {
                    P.paper
                    if confetti { ConfettiBackdrop() }
                }
            }
        } else {
            content
                .padding(16)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(
                    ZStack {
                        P.paper
                        if confetti { ConfettiBackdrop() }
                    }
                )
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
    func stickerWidgetBackground(confetti: Bool = false) -> some View { modifier(StickerWidgetBackground(confetti: confetti)) }
}

/// Fragola che dorme + due righe: vuoto, non collegato, fermo da più di 48 h. Tocco: apre "Noi".
struct SleepyView: View {
    let entry: FragolinaEntry
    let compact: Bool

    private var title: String {
        switch entry.state {
        case .empty: return WS.emptyTitle
        case .unpaired: return WS.unpairedTitle
        default: return compact ? WS.staleTitleShort : WS.staleTitle
        }
    }
    private var sub: String {
        switch entry.state {
        case .empty: return WS.emptySub
        case .unpaired: return WS.unpairedSub
        default: return WS.staleSub
        }
    }

    var body: some View {
        Group {
            if compact {
                VStack(alignment: .leading, spacing: 4) {
                    MascotView(sleeping: true, size: 58)
                    Spacer(minLength: 0)
                    Text(title).font(display(19)).foregroundStyle(P.ink).minimumScaleFactor(0.6).lineLimit(2)
                    Text(sub).font(bodyFont(12, .semibold)).foregroundStyle(P.ink).lineLimit(2).minimumScaleFactor(0.85)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            } else {
                HStack(spacing: 16) {
                    MascotView(sleeping: true, size: 92)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title).font(display(26)).foregroundStyle(P.ink).minimumScaleFactor(0.6).lineLimit(2)
                        Text(sub).font(bodyFont(14, .semibold)).foregroundStyle(P.ink).lineLimit(2).minimumScaleFactor(0.85)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .widgetURL(WidgetLink.us)
    }
}

/// Stato per la schermata di blocco (monocromatico).
struct LockSleepy: View {
    let entry: FragolinaEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    Image(systemName: "moon.zzz.fill").font(.system(size: 24))
                }
            case .accessoryInline:
                Label(WS.lockEmpty, systemImage: "moon.zzz.fill")
            default:
                VStack(alignment: .leading, spacing: 1) {
                    Label(entry.state == .hardStale ? WS.staleTitle : WS.lockEmpty, systemImage: "moon.zzz.fill")
                        .font(.system(size: 14, weight: .bold))
                    Text(entry.state == .hardStale ? WS.staleSub : WS.emptySub)
                        .font(.system(size: 12, weight: .semibold))
                        .lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .widgetURL(WidgetLink.us)
        .accessoryWidgetBackgroundCompat()
    }
}

/// Faccia dell'umore di lei (fragola); se non l'ha ancora scelto, un adesivo tratteggiato con il punto interrogativo.
struct MoodOrPlaceholder: View {
    let moodId: String?
    let size: CGFloat

    var body: some View {
        if let moodId {
            StrawberryFace(mood: moodId, size: size)
        } else {
            ZStack {
                Circle().fill(P.skySoft)
                Circle().stroke(P.ink, style: StrokeStyle(lineWidth: 2.5, dash: [4, 4]))
                Text("?").font(display(size * 0.5)).foregroundStyle(P.ink)
            }
            .frame(width: size * 0.92, height: size * 0.92)
            .frame(width: size, height: size * 240 / 220)
        }
    }
}

/// Pillola "da 2 h" / "agg. 5 h": se i dati sono vecchi (> 3 h) dice da quanto sono fermi.
struct AgePill: View {
    let entry: FragolinaEntry
    var since: String? = nil

    var body: some View {
        if entry.isSoftStale {
            StickerPill(text: entry.ageShort, fill: P.butter, size: 11, symbol: "clock", rotation: 2)
        } else if let since {
            StickerPill(text: since, fill: P.butterSoft, size: 11, rotation: 2)
        }
    }
}
