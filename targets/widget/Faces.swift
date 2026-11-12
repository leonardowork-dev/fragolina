import SwiftUI
import UIKit

// Disegni a codice: la fragola con un'espressione per ogni umore, la fragola che dorme, la faccina monocromatica per
// la schermata di blocco e i coriandoli statici. Coordinate come negli SVG dell'app (mascotte 220x240, facce 100x100).
// Niente gradienti, niente blur, niente animazioni (DESIGN.md).

// MARK: - Percorsi

private func heartPath(_ cx: CGFloat, _ cy: CGFloat, _ s: CGFloat) -> Path {
    var p = Path()
    p.move(to: CGPoint(x: cx, y: cy + 8 * s))
    p.addCurve(to: CGPoint(x: cx, y: cy - 5 * s), control1: CGPoint(x: cx - 12 * s, y: cy - 2 * s), control2: CGPoint(x: cx - 8 * s, y: cy - 12 * s))
    p.addCurve(to: CGPoint(x: cx, y: cy + 8 * s), control1: CGPoint(x: cx + 8 * s, y: cy - 12 * s), control2: CGPoint(x: cx + 12 * s, y: cy - 2 * s))
    p.closeSubpath()
    return p
}

private func starPath(_ cx: CGFloat, _ cy: CGFloat, _ s: CGFloat) -> Path {
    var p = Path()
    let pts: [(CGFloat, CGFloat)] = [(0, -9), (2.4, -2.4), (9, 0), (2.4, 2.4), (0, 9), (-2.4, 2.4), (-9, 0), (-2.4, -2.4)]
    for (i, q) in pts.enumerated() {
        let pt = CGPoint(x: cx + q.0 * s, y: cy + q.1 * s)
        if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
    }
    p.closeSubpath()
    return p
}

private func quad(_ a: (CGFloat, CGFloat), _ c: (CGFloat, CGFloat), _ b: (CGFloat, CGFloat)) -> Path {
    var p = Path()
    p.move(to: CGPoint(x: a.0, y: a.1))
    p.addQuadCurve(to: CGPoint(x: b.0, y: b.1), control: CGPoint(x: c.0, y: c.1))
    return p
}

/// Colore dell'adesivo umore (stessa tabella di MoodSticker.tsx): serve per il fondo dell'adesivo nei widget.
func moodFill(_ moodId: String?) -> Color {
    switch moodId {
    case "felice": return P.butter
    case "innamorata": return P.blush
    case "stanca": return P.sky
    case "affamata": return P.leaf
    case "stressata": return P.strawberry
    case "triste": return P.skySoft
    case "coccole": return P.blushSoft
    case "carica": return P.butterSoft
    default: return P.butter
    }
}

// MARK: - Espressioni (spazio 100x100, centro 50,50)

/// Occhi e bocca di un umore. `white`/`cheek` = nil per il disegno monocromatico (schermata di blocco).
private func drawMoodFeatures(_ ctx: inout GraphicsContext, mood: String?, ink: Color, white: Color?, cheek: Color?, lineWidth: CGFloat = 4.5) {
    let line = StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round)
    func dot(_ x: CGFloat, _ y: CGFloat) {
        ctx.fill(Path(ellipseIn: CGRect(x: x - 4.6, y: y - 4.6, width: 9.2, height: 9.2)), with: .color(ink))
        if let white { ctx.fill(Path(ellipseIn: CGRect(x: x + 0.1, y: y - 3.2, width: 3, height: 3)), with: .color(white)) }
    }
    switch mood {
    case "innamorata":
        ctx.fill(heartPath(36, 42, 1.25), with: .color(ink))
        ctx.fill(heartPath(64, 42, 1.25), with: .color(ink))
        ctx.stroke(quad((41, 61), (50, 72), (59, 61)), with: .color(ink), style: line)
    case "stanca":
        ctx.stroke(quad((29, 45), (37, 53), (45, 45)), with: .color(ink), style: line)
        ctx.stroke(quad((55, 45), (63, 53), (71, 45)), with: .color(ink), style: line)
        var m = Path(); m.move(to: CGPoint(x: 43, y: 64)); m.addLine(to: CGPoint(x: 57, y: 64))
        ctx.stroke(m, with: .color(ink), style: line)
    case "affamata":
        dot(37, 42); dot(63, 42)
        var mouth = Path()
        mouth.move(to: CGPoint(x: 34, y: 56))
        mouth.addQuadCurve(to: CGPoint(x: 66, y: 56), control: CGPoint(x: 50, y: 82))
        mouth.closeSubpath()
        ctx.fill(mouth, with: .color(ink))
    case "stressata":
        for x in [36.0, 64.0] {
            let r = Path(ellipseIn: CGRect(x: x - 8, y: 34, width: 16, height: 16))
            if let white { ctx.fill(r, with: .color(white)) }
            ctx.stroke(r, with: .color(ink), lineWidth: 2.6)
            ctx.fill(Path(ellipseIn: CGRect(x: x - 2.6 + (x < 50 ? 1 : -1), y: 40.4, width: 5.2, height: 5.2)), with: .color(ink))
        }
        var w = Path()
        w.move(to: CGPoint(x: 30, y: 66))
        w.addQuadCurve(to: CGPoint(x: 42, y: 66), control: CGPoint(x: 36, y: 59))
        w.addQuadCurve(to: CGPoint(x: 54, y: 66), control: CGPoint(x: 48, y: 73))
        w.addQuadCurve(to: CGPoint(x: 66, y: 66), control: CGPoint(x: 60, y: 59))
        ctx.stroke(w, with: .color(ink), style: line)
    case "triste":
        dot(37, 42); dot(63, 42)
        ctx.stroke(quad((38, 68), (50, 56), (62, 68)), with: .color(ink), style: line)
    case "coccole":
        ctx.stroke(quad((29, 46), (37, 37), (45, 46)), with: .color(ink), style: line)
        ctx.stroke(quad((55, 46), (63, 37), (71, 46)), with: .color(ink), style: line)
        var w = Path()
        w.move(to: CGPoint(x: 42, y: 58))
        w.addQuadCurve(to: CGPoint(x: 50, y: 58), control: CGPoint(x: 46, y: 65))
        w.addQuadCurve(to: CGPoint(x: 58, y: 58), control: CGPoint(x: 54, y: 65))
        ctx.stroke(w, with: .color(ink), style: line)
    case "carica":
        ctx.fill(starPath(36, 42, 1.15), with: .color(ink))
        ctx.fill(starPath(64, 42, 1.15), with: .color(ink))
        ctx.stroke(quad((33, 56), (50, 74), (67, 56)), with: .color(ink), style: line)
    default: // felice (e sconosciuto)
        dot(37, 42); dot(63, 42)
        var mouth = Path()
        mouth.move(to: CGPoint(x: 31, y: 55))
        mouth.addQuadCurve(to: CGPoint(x: 69, y: 55), control: CGPoint(x: 50, y: 80))
        mouth.closeSubpath()
        ctx.fill(mouth, with: .color(ink))
    }
    if let cheek, mood == "coccole" || mood == "innamorata" {
        // guance più grandi e rosa nei due umori "morbidi"
        ctx.fill(Path(ellipseIn: CGRect(x: 18, y: 50, width: 13, height: 9)), with: .color(cheek))
        ctx.fill(Path(ellipseIn: CGRect(x: 69, y: 50, width: 13, height: 9)), with: .color(cheek))
    }
}

// MARK: - Fragola (corpo)

private let strawberryBody: Path = {
    var p = Path()
    p.move(to: CGPoint(x: 110, y: 64))
    p.addCurve(to: CGPoint(x: 188, y: 118), control1: CGPoint(x: 150, y: 48), control2: CGPoint(x: 192, y: 66))
    p.addCurve(to: CGPoint(x: 110, y: 222), control1: CGPoint(x: 184, y: 170), control2: CGPoint(x: 146, y: 214))
    p.addCurve(to: CGPoint(x: 32, y: 118), control1: CGPoint(x: 74, y: 214), control2: CGPoint(x: 36, y: 170))
    p.addCurve(to: CGPoint(x: 110, y: 64), control1: CGPoint(x: 28, y: 66), control2: CGPoint(x: 70, y: 48))
    p.closeSubpath()
    return p
}()

private func leafPath(_ a: (CGFloat, CGFloat), _ c1: (CGFloat, CGFloat), _ c2: (CGFloat, CGFloat), _ b: (CGFloat, CGFloat), _ c3: (CGFloat, CGFloat), _ c4: (CGFloat, CGFloat)) -> Path {
    var p = Path()
    p.move(to: CGPoint(x: a.0, y: a.1))
    p.addCurve(to: CGPoint(x: b.0, y: b.1), control1: CGPoint(x: c1.0, y: c1.1), control2: CGPoint(x: c2.0, y: c2.1))
    p.addCurve(to: CGPoint(x: a.0, y: a.1), control1: CGPoint(x: c3.0, y: c3.1), control2: CGPoint(x: c4.0, y: c4.1))
    p.closeSubpath()
    return p
}

private let strawberryLeaves: [Path] = [
    leafPath((110, 68), (98, 46), (102, 26), (110, 14), (118, 26), (122, 46)),
    leafPath((106, 70), (82, 70), (58, 60), (48, 42), (74, 38), (98, 48)),
    leafPath((114, 70), (138, 70), (162, 60), (172, 42), (146, 38), (122, 48)),
]

private let strawberrySeeds: [(CGFloat, CGFloat)] = [(60, 176), (160, 176), (86, 198), (134, 198), (44, 112), (176, 112)]

/// Corpo adesivo: ombra dura, bordo bianco fustellato, riempimento fragola, contorno inchiostro, foglie, semi.
private func drawStrawberryBody(_ ctx: inout GraphicsContext, fill: Color = P.strawberry, shadow: Bool = true) {
    let border: CGFloat = 14
    if shadow {
        var sh = ctx
        sh.translateBy(x: 6, y: 6)
        sh.stroke(strawberryBody, with: .color(P.ink), style: StrokeStyle(lineWidth: border + 5, lineJoin: .round))
        sh.fill(strawberryBody, with: .color(P.ink))
    }
    ctx.stroke(strawberryBody, with: .color(P.ink), style: StrokeStyle(lineWidth: border + 5, lineJoin: .round))
    ctx.stroke(strawberryBody, with: .color(P.white), style: StrokeStyle(lineWidth: border, lineJoin: .round))
    ctx.fill(strawberryBody, with: .color(P.white))
    ctx.fill(strawberryBody, with: .color(fill))
    ctx.stroke(strawberryBody, with: .color(P.ink), style: StrokeStyle(lineWidth: 5, lineJoin: .round))
    for (x, y) in strawberrySeeds {
        ctx.fill(Path(ellipseIn: CGRect(x: x - 3.4, y: y - 5, width: 6.8, height: 10)), with: .color(P.butterSoft))
    }
    for l in strawberryLeaves {
        ctx.fill(l, with: .color(P.leaf))
        ctx.stroke(l, with: .color(P.ink), style: StrokeStyle(lineWidth: 5, lineJoin: .round))
    }
}

/// La fragola con la faccia dell'umore (`mood`), o che dorme (`sleeping`).
struct StrawberryFace: View {
    var mood: String? = "felice"
    var sleeping: Bool = false
    var size: CGFloat = 70

    var body: some View {
        Canvas { ctx, sz in
            let k = sz.width / 220
            ctx.scaleBy(x: k, y: k)
            drawStrawberryBody(&ctx)
            if sleeping {
                let s = StrokeStyle(lineWidth: 7, lineCap: .round, lineJoin: .round)
                var e1 = Path(); e1.move(to: CGPoint(x: 68, y: 126)); e1.addQuadCurve(to: CGPoint(x: 92, y: 126), control: CGPoint(x: 80, y: 138))
                var e2 = Path(); e2.move(to: CGPoint(x: 128, y: 126)); e2.addQuadCurve(to: CGPoint(x: 152, y: 126), control: CGPoint(x: 140, y: 138))
                ctx.stroke(e1, with: .color(P.ink), style: s)
                ctx.stroke(e2, with: .color(P.ink), style: s)
                ctx.fill(Path(ellipseIn: CGRect(x: 44, y: 139, width: 28, height: 17)), with: .color(P.blush))
                ctx.fill(Path(ellipseIn: CGRect(x: 148, y: 139, width: 28, height: 17)), with: .color(P.blush))
                var m = Path(); m.move(to: CGPoint(x: 103, y: 150)); m.addQuadCurve(to: CGPoint(x: 117, y: 150), control: CGPoint(x: 110, y: 156))
                ctx.stroke(m, with: .color(P.ink), style: s)
                var z = Path(); z.move(to: CGPoint(x: 160, y: 62)); z.addLine(to: CGPoint(x: 174, y: 62)); z.addLine(to: CGPoint(x: 160, y: 78)); z.addLine(to: CGPoint(x: 174, y: 78))
                ctx.stroke(z, with: .color(P.ink), style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
            } else {
                // guance di default (blush); quelle "morbide" le disegna drawMoodFeatures
                if mood != "coccole" && mood != "innamorata" {
                    ctx.fill(Path(ellipseIn: CGRect(x: 44, y: 139, width: 28, height: 17)), with: .color(P.blush))
                    ctx.fill(Path(ellipseIn: CGRect(x: 148, y: 139, width: 28, height: 17)), with: .color(P.blush))
                }
                var f = ctx
                f.translateBy(x: 110, y: 144)
                f.scaleBy(x: 2.3, y: 2.3)
                f.translateBy(x: -50, y: -50)
                drawMoodFeatures(&f, mood: mood, ink: P.ink, white: P.white, cheek: P.strawberrySoft, lineWidth: 3.8)
            }
        }
        .frame(width: size, height: size * 240 / 220)
        .accessibilityHidden(true)
    }
}

/// Fragola che dorme (stato vuoto / non aggiornato).
struct SleepyStrawberry: View {
    var size: CGFloat = 70
    var body: some View { StrawberryFace(sleeping: true, size: size) }
}

// MARK: - Artwork nostro (slot)

enum UserArt {
    /// `assets/user-art/widget-mascot.png` viene copiato in Assets.xcassets/widget-mascot.imageset al prebuild
    /// (scripts/widget-art.js, chiamato da app.config.js). Se non c'è, resta la fragola disegnata.
    static let hasMascot: Bool = UIImage(named: "widget-mascot") != nil
}

/// La mascotte del widget: il vostro disegno se c'è, altrimenti la fragola disegnata (felice o che dorme).
struct MascotView: View {
    var mood: String? = "felice"
    var sleeping: Bool = false
    var size: CGFloat = 60

    var body: some View {
        if UserArt.hasMascot {
            Image("widget-mascot")
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
                .opacity(sleeping ? 0.55 : 1)
                .accessibilityHidden(true)
        } else {
            StrawberryFace(mood: mood, sleeping: sleeping, size: size)
        }
    }
}

// MARK: - Faccina monocromatica (schermata di blocco)

/// Faccina a linee, un solo colore (`.primary`): si legge in "vibrant" e in "accented". Cerchio vuoto + espressione.
struct LockMoodGlyph: View {
    let moodId: String?
    var size: CGFloat = 40

    var body: some View {
        Canvas { ctx, sz in
            let k = sz.width / 100
            ctx.scaleBy(x: k, y: k)
            let ink = Color.primary
            ctx.stroke(Path(ellipseIn: CGRect(x: 6, y: 6, width: 88, height: 88)), with: .color(ink), lineWidth: 6)
            if moodId == nil {
                // nessun umore ancora: tre puntini
                for x in [32.0, 50.0, 68.0] {
                    ctx.fill(Path(ellipseIn: CGRect(x: x - 4.5, y: 45.5, width: 9, height: 9)), with: .color(ink))
                }
            } else {
                drawMoodFeatures(&ctx, mood: moodId, ink: ink, white: nil, cheek: nil, lineWidth: 6)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - Coriandoli statici (giorno di festa)

/// Pezzetti piatti con contorno, posizioni fisse (niente animazione, niente casualità a ogni ridisegno).
struct ConfettiBackdrop: View {
    private struct Piece { let x: CGFloat; let y: CGFloat; let r: CGFloat; let kind: Int; let color: Int }
    private static let pieces: [Piece] = [
        Piece(x: 0.06, y: 0.10, r: 20, kind: 0, color: 0), Piece(x: 0.30, y: 0.05, r: -30, kind: 1, color: 1),
        Piece(x: 0.52, y: 0.12, r: 40, kind: 2, color: 2), Piece(x: 0.78, y: 0.06, r: -15, kind: 0, color: 3),
        Piece(x: 0.94, y: 0.20, r: 35, kind: 1, color: 4), Piece(x: 0.04, y: 0.42, r: -40, kind: 2, color: 3),
        Piece(x: 0.96, y: 0.50, r: 15, kind: 0, color: 1), Piece(x: 0.10, y: 0.80, r: 30, kind: 1, color: 2),
        Piece(x: 0.34, y: 0.94, r: -25, kind: 0, color: 4), Piece(x: 0.58, y: 0.90, r: 45, kind: 2, color: 0),
        Piece(x: 0.82, y: 0.92, r: -35, kind: 1, color: 3), Piece(x: 0.93, y: 0.78, r: 20, kind: 2, color: 1),
    ]
    private static let colors: [Color] = [P.strawberry, P.butter, P.sky, P.leaf, P.blush]

    var body: some View {
        Canvas { ctx, sz in
            for p in Self.pieces {
                var c = ctx
                c.translateBy(x: p.x * sz.width, y: p.y * sz.height)
                c.rotate(by: .degrees(Double(p.r)))
                let path: Path
                switch p.kind {
                case 0: path = Path(CGRect(x: -4, y: -2.5, width: 8, height: 5))
                case 1: path = Path(ellipseIn: CGRect(x: -3, y: -3, width: 6, height: 6))
                default:
                    var t = Path()
                    t.move(to: CGPoint(x: 0, y: -4)); t.addLine(to: CGPoint(x: 4, y: 3)); t.addLine(to: CGPoint(x: -4, y: 3)); t.closeSubpath()
                    path = t
                }
                c.fill(path, with: .color(Self.colors[p.color]))
                c.stroke(path, with: .color(P.ink), lineWidth: 1.2)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
