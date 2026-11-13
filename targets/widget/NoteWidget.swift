import SwiftUI
import WidgetKit

// "Biglietto": il disegno o la scritta che lei ti lascia (o che lasci tu: Leonardo da solo vede i SUOI, "da te").
// Il disegno viaggia come vettori (tratti con punti 0...1000) e qui si ridisegna con Canvas in ogni misura; sulla
// schermata di blocco è monocromatico con tratti più spessi. Scade da solo: la timeline ha una voce un attimo dopo la
// scadenza (noteTimelineDates). Tocco: apre la scheda Disegna (fragolina://draw).

func noteInk(_ key: String?) -> Color {
    switch key {
    case "strawberry": return P.strawberry
    case "leaf": return P.leaf
    case "sky": return P.sky
    case "butter": return P.butter
    default: return P.ink
    }
}

func noteBg(_ key: String?) -> Color {
    switch key {
    case "blush": return P.blush
    case "sky": return P.sky
    case "leaf": return P.leaf
    case "strawberry": return P.strawberry
    case "paper": return P.paper
    default: return P.butter
    }
}

func noteTextInk(_ bg: String?) -> Color { bg == "strawberry" ? P.paper : P.ink }

/// Il disegno, nel quadrato più grande che sta nello spazio. `mono`: un solo colore (schermata di blocco).
struct NoteDrawing: View {
    let strokes: [NoteStroke]
    var mono: Bool = false

    var body: some View {
        Canvas { ctx, sz in
            let s = min(sz.width, sz.height)
            let ox = (sz.width - s) / 2
            let oy = (sz.height - s) / 2
            for st in strokes {
                let pts: [CGPoint] = (st.p ?? []).compactMap { q in
                    guard q.count >= 2 else { return nil }
                    return CGPoint(x: ox + CGFloat(q[0]) / 1000 * s, y: oy + CGFloat(q[1]) / 1000 * s)
                }
                guard let first = pts.first else { continue }
                let thick = (st.w ?? 1) >= 2
                let base = s * (thick ? 0.034 : 0.017)
                // sulla schermata di blocco i tratti sono più spessi (si leggono in "vibrant")
                let lw = mono ? max(base * 1.5, thick ? 4.5 : 3) : max(base, thick ? 3 : 2)
                let color: Color = mono ? .primary : noteInk(st.c)
                if pts.allSatisfy({ $0 == first }) {
                    ctx.fill(Path(ellipseIn: CGRect(x: first.x - lw / 2, y: first.y - lw / 2, width: lw, height: lw)), with: .color(color))
                    continue
                }
                var path = Path()
                path.move(to: first)
                for p in pts.dropFirst() { path.addLine(to: p) }
                ctx.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: lw, lineCap: .round, lineJoin: .round))
            }
        }
        .accessibilityHidden(true)
    }
}

/// Il biglietto come adesso: foglio bianco con il disegno, oppure sfondo colorato con la scritta.
struct NoteCard: View {
    let note: NoteDisplay
    var fontSize: CGFloat = 20
    var offset: CGFloat = 3

    var body: some View {
        if note.kind == "text" {
            let bg = note.content.bg
            StickerBox(fill: noteBg(bg), radius: 16, offset: offset, rotation: -1) {
                Text(note.content.text ?? "")
                    .font(display(fontSize)).tracking(-0.3)
                    .foregroundStyle(noteTextInk(bg))
                    .multilineTextAlignment(.leading)
                    .lineLimit(6)
                    .minimumScaleFactor(0.35)
                    .padding(9)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        } else {
            StickerBox(fill: P.white, radius: 16, offset: offset, rotation: 0) {
                NoteDrawing(strokes: note.content.strokes ?? [])
                    .padding(6)
                    .aspectRatio(1, contentMode: .fit)
            }
        }
    }
}

struct NoteEmptyHome: View {
    let compact: Bool

    var body: some View {
        Group {
            if compact {
                VStack(alignment: .leading, spacing: 4) {
                    MascotView(mood: "felice", size: 58)
                    Spacer(minLength: 0)
                    Text(WS.noteEmptyTitle).font(display(19)).foregroundStyle(P.ink).minimumScaleFactor(0.6).lineLimit(2)
                    Text(WS.noteEmptySub).font(bodyFont(12, .semibold)).foregroundStyle(P.ink).lineLimit(2).minimumScaleFactor(0.85)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            } else {
                HStack(spacing: 16) {
                    MascotView(mood: "felice", size: 92)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(WS.noteEmptyTitle).font(display(26)).foregroundStyle(P.ink).minimumScaleFactor(0.6).lineLimit(2)
                        Text(WS.noteEmptySub).font(bodyFont(14, .semibold)).foregroundStyle(P.ink).lineLimit(2).minimumScaleFactor(0.85)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .widgetURL(WidgetLink.draw)
    }
}

struct NoteSmallView: View {
    let entry: FragolinaEntry
    let note: NoteDisplay

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            NoteCard(note: note, fontSize: 22, offset: 3)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.trailing, 3).padding(.bottom, 3)
            if let line = entry.noteByLine {
                Text(line).font(bodyFont(11, .heavy)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.6)
            }
        }
        .widgetURL(WidgetLink.draw)
        .accessibilityElement(children: .combine)
    }
}

struct NoteMediumView: View {
    let entry: FragolinaEntry
    let note: NoteDisplay

    var body: some View {
        Group {
            if note.kind == "text" {
                VStack(alignment: .leading, spacing: 5) {
                    NoteCard(note: note, fontSize: 28, offset: 3)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(.trailing, 3).padding(.bottom, 3)
                    footer
                }
            } else {
                HStack(spacing: 14) {
                    NoteCard(note: note, offset: 3)
                        .padding(.trailing, 3).padding(.bottom, 3)
                    VStack(alignment: .leading, spacing: 4) {
                        Spacer(minLength: 0)
                        if let line = entry.noteByLine {
                            Text(line).font(bodyFont(14, .heavy)).foregroundStyle(P.ink).lineLimit(2).minimumScaleFactor(0.7)
                        }
                        Text(WS.noteLeaves(entry.noteMinutesLeft)).font(bodyFont(11, .semibold)).foregroundStyle(P.ink)
                            .lineLimit(2).minimumScaleFactor(0.8)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .widgetURL(WidgetLink.draw)
        .accessibilityElement(children: .combine)
    }

    private var footer: some View {
        HStack(spacing: 6) {
            if let line = entry.noteByLine {
                Text(line).font(bodyFont(12, .heavy)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.6)
            }
            Spacer(minLength: 0)
            Text(WS.noteLeaves(entry.noteMinutesLeft)).font(bodyFont(10, .semibold)).foregroundStyle(P.ink)
                .lineLimit(1).minimumScaleFactor(0.6)
        }
    }
}

/// Schermata di blocco (rettangolo): disegno monocromatico a sinistra, "da chi" a destra; la scritta occupa tutto.
struct NoteLockView: View {
    let entry: FragolinaEntry

    var body: some View {
        Group {
            if let note = entry.noteDisplay {
                if note.kind == "text" {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(note.content.text ?? "")
                            .font(.system(size: 14, weight: .heavy, design: .rounded))
                            .lineLimit(3).minimumScaleFactor(0.7)
                        if let line = entry.noteByLine {
                            Text(line).font(.system(size: 11, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7).opacity(0.8)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    HStack(spacing: 8) {
                        NoteDrawing(strokes: note.content.strokes ?? [], mono: true)
                            .frame(width: 54, height: 54)
                        VStack(alignment: .leading, spacing: 1) {
                            if let line = entry.noteByLine {
                                Text(line).font(.system(size: 12, weight: .bold)).lineLimit(2).minimumScaleFactor(0.7)
                            }
                            Text(WS.noteLeaves(entry.noteMinutesLeft)).font(.system(size: 11, weight: .semibold)).lineLimit(2)
                                .minimumScaleFactor(0.7).opacity(0.8)
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                VStack(alignment: .leading, spacing: 1) {
                    Label(WS.noteEmptyShort, systemImage: "heart.fill").font(.system(size: 14, weight: .bold))
                    Text(WS.noteEmptyLock).font(.system(size: 12, weight: .semibold))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .widgetURL(WidgetLink.draw)
        .accessoryWidgetBackgroundCompat()
    }
}

struct NoteWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        if family == .accessoryRectangular {
            NoteLockView(entry: entry)
        } else {
            Group {
                if let note = entry.noteDisplay {
                    if family == .systemMedium {
                        NoteMediumView(entry: entry, note: note)
                    } else {
                        NoteSmallView(entry: entry, note: note)
                    }
                } else {
                    NoteEmptyHome(compact: family != .systemMedium)
                }
            }
            .stickerWidgetBackground()
        }
    }
}

struct NoteWidget: Widget {
    let kind = "FragolinaNote"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NoteProvider()) { entry in
            NoteWidgetView(entry: entry)
        }
        .configurationDisplayName(WS.noteGalleryName)
        .description(WS.noteGalleryDesc)
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}
