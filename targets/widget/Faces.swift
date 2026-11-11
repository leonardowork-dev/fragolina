import SwiftUI

// Disegni a codice: adesivi umore e mascotte che dorme. Coordinate come negli SVG dell'app (viewBox 100 / 220x240).

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

struct MoodFace: View {
    let moodId: String
    var size: CGFloat = 64

    private func fill() -> Color {
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

    var body: some View {
        Canvas { ctx, sz in
            let k = sz.width / 100
            ctx.scaleBy(x: k, y: k)
            let line = StrokeStyle(lineWidth: 4.5, lineCap: .round, lineJoin: .round)
            func dot(_ x: CGFloat, _ y: CGFloat) {
                ctx.fill(Path(ellipseIn: CGRect(x: x - 4.6, y: y - 4.6, width: 9.2, height: 9.2)), with: .color(P.ink))
                ctx.fill(Path(ellipseIn: CGRect(x: x + 0.1, y: y - 3.2, width: 3, height: 3)), with: .color(.white))
            }
            let circle = Path(ellipseIn: CGRect(x: 6, y: 6, width: 88, height: 88))
            ctx.fill(circle, with: .color(fill()))
            ctx.stroke(circle, with: .color(P.ink), lineWidth: 2.5 / k * 1.0)
            switch moodId {
            case "innamorata":
                ctx.fill(heartPath(36, 42, 1), with: .color(P.strawberry))
                ctx.stroke(heartPath(36, 42, 1), with: .color(P.ink), lineWidth: 2)
                ctx.fill(heartPath(64, 42, 1), with: .color(P.strawberry))
                ctx.stroke(heartPath(64, 42, 1), with: .color(P.ink), lineWidth: 2)
                ctx.stroke(quad((41, 60), (50, 70), (59, 60)), with: .color(P.ink), style: line)
            case "stanca":
                ctx.stroke(quad((29, 45), (37, 53), (45, 45)), with: .color(P.ink), style: line)
                ctx.stroke(quad((55, 45), (63, 53), (71, 45)), with: .color(P.ink), style: line)
                var m = Path(); m.move(to: CGPoint(x: 43, y: 64)); m.addLine(to: CGPoint(x: 57, y: 64))
                ctx.stroke(m, with: .color(P.ink), style: line)
            case "affamata":
                dot(37, 42); dot(63, 42)
                var mouth = Path()
                mouth.move(to: CGPoint(x: 34, y: 56))
                mouth.addQuadCurve(to: CGPoint(x: 66, y: 56), control: CGPoint(x: 50, y: 82))
                mouth.closeSubpath()
                ctx.fill(mouth, with: .color(P.ink))
            case "stressata":
                for x in [36.0, 64.0] {
                    let r = Path(ellipseIn: CGRect(x: x - 8, y: 34, width: 16, height: 16))
                    ctx.fill(r, with: .color(.white)); ctx.stroke(r, with: .color(P.ink), lineWidth: 2.2)
                    ctx.fill(Path(ellipseIn: CGRect(x: x - 2.6 + (x < 50 ? 1 : -1), y: 40.4, width: 5.2, height: 5.2)), with: .color(P.ink))
                }
                var w = Path()
                w.move(to: CGPoint(x: 30, y: 66))
                w.addQuadCurve(to: CGPoint(x: 42, y: 66), control: CGPoint(x: 36, y: 59))
                w.addQuadCurve(to: CGPoint(x: 54, y: 66), control: CGPoint(x: 48, y: 73))
                w.addQuadCurve(to: CGPoint(x: 66, y: 66), control: CGPoint(x: 60, y: 59))
                ctx.stroke(w, with: .color(P.ink), style: line)
            case "triste":
                dot(37, 42); dot(63, 42)
                ctx.stroke(quad((38, 68), (50, 56), (62, 68)), with: .color(P.ink), style: line)
            case "coccole":
                ctx.stroke(quad((29, 46), (37, 37), (45, 46)), with: .color(P.ink), style: line)
                ctx.stroke(quad((55, 46), (63, 37), (71, 46)), with: .color(P.ink), style: line)
                ctx.fill(Path(ellipseIn: CGRect(x: 24.5, y: 50.5, width: 11, height: 11)), with: .color(P.strawberrySoft))
                ctx.fill(Path(ellipseIn: CGRect(x: 64.5, y: 50.5, width: 11, height: 11)), with: .color(P.strawberrySoft))
                var w = Path()
                w.move(to: CGPoint(x: 42, y: 58))
                w.addQuadCurve(to: CGPoint(x: 50, y: 58), control: CGPoint(x: 46, y: 65))
                w.addQuadCurve(to: CGPoint(x: 58, y: 58), control: CGPoint(x: 54, y: 65))
                ctx.stroke(w, with: .color(P.ink), style: line)
            case "carica":
                ctx.fill(starPath(36, 42, 1.05), with: .color(P.ink))
                ctx.fill(starPath(64, 42, 1.05), with: .color(P.ink))
                ctx.stroke(quad((33, 56), (50, 74), (67, 56)), with: .color(P.ink), style: line)
            default: // felice
                dot(37, 42); dot(63, 42)
                var mouth = Path()
                mouth.move(to: CGPoint(x: 31, y: 55))
                mouth.addQuadCurve(to: CGPoint(x: 69, y: 55), control: CGPoint(x: 50, y: 80))
                mouth.closeSubpath()
                ctx.fill(mouth, with: .color(P.ink))
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Fragola che dorme (stato vuoto / non aggiornato del widget).
struct SleepyStrawberry: View {
    var size: CGFloat = 70

    var body: some View {
        Canvas { ctx, sz in
            let k = sz.width / 220
            ctx.scaleBy(x: k, y: k)
            var bodyPath = Path()
            bodyPath.move(to: CGPoint(x: 110, y: 64))
            bodyPath.addCurve(to: CGPoint(x: 188, y: 118), control1: CGPoint(x: 150, y: 48), control2: CGPoint(x: 192, y: 66))
            bodyPath.addCurve(to: CGPoint(x: 110, y: 222), control1: CGPoint(x: 184, y: 170), control2: CGPoint(x: 146, y: 214))
            bodyPath.addCurve(to: CGPoint(x: 32, y: 118), control1: CGPoint(x: 74, y: 214), control2: CGPoint(x: 36, y: 170))
            bodyPath.addCurve(to: CGPoint(x: 110, y: 64), control1: CGPoint(x: 28, y: 66), control2: CGPoint(x: 70, y: 48))
            bodyPath.closeSubpath()
            func leaf(_ a: (CGFloat, CGFloat), _ c1: (CGFloat, CGFloat), _ c2: (CGFloat, CGFloat), _ b: (CGFloat, CGFloat), _ c3: (CGFloat, CGFloat), _ c4: (CGFloat, CGFloat)) -> Path {
                var p = Path()
                p.move(to: CGPoint(x: a.0, y: a.1))
                p.addCurve(to: CGPoint(x: b.0, y: b.1), control1: CGPoint(x: c1.0, y: c1.1), control2: CGPoint(x: c2.0, y: c2.1))
                p.addCurve(to: CGPoint(x: a.0, y: a.1), control1: CGPoint(x: c3.0, y: c3.1), control2: CGPoint(x: c4.0, y: c4.1))
                p.closeSubpath()
                return p
            }
            let leaves = [
                leaf((110, 68), (98, 46), (102, 26), (110, 14), (118, 26), (122, 46)),
                leaf((106, 70), (82, 70), (58, 60), (48, 42), (74, 38), (98, 48)),
                leaf((114, 70), (138, 70), (162, 60), (172, 42), (146, 38), (122, 48)),
            ]
            let border: CGFloat = 14
            // ombra dura
            var sh = ctx
            sh.translateBy(x: 5, y: 5)
            sh.stroke(bodyPath, with: .color(P.ink), style: StrokeStyle(lineWidth: border + 5, lineJoin: .round))
            sh.fill(bodyPath, with: .color(P.ink))
            ctx.stroke(bodyPath, with: .color(P.ink), style: StrokeStyle(lineWidth: border + 5, lineJoin: .round))
            ctx.stroke(bodyPath, with: .color(.white), style: StrokeStyle(lineWidth: border, lineJoin: .round))
            ctx.fill(bodyPath, with: .color(.white))
            ctx.fill(bodyPath, with: .color(P.strawberry))
            ctx.stroke(bodyPath, with: .color(P.ink), style: StrokeStyle(lineWidth: 5, lineJoin: .round))
            for l in leaves {
                ctx.fill(l, with: .color(P.leaf))
                ctx.stroke(l, with: .color(P.ink), style: StrokeStyle(lineWidth: 5, lineJoin: .round))
            }
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
        }
        .frame(width: size, height: size * 240 / 220)
        .accessibilityHidden(true)
    }
}
