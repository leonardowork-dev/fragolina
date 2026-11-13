import SwiftUI

// Il pet disegnato a codice: stessa fragola adesivo della mascotte in quattro stadi (semino, germoglio, fragolina,
// fragolona) più l'uovo, con la faccia che dipende dai bisogni. Specchio di src/design/mascot/PetArt.tsx
// (coordinate 220x250). Niente gradienti, niente blur, niente animazioni (DESIGN.md).

private func stageScale(_ stage: String) -> CGFloat {
    switch stage {
    case "seed": return 0.62
    case "sprout": return 0.76
    case "berry": return 0.9
    default: return 1
    }
}

private func stageFill(_ stage: String) -> Color {
    switch stage {
    case "seed": return P.butter
    case "sprout": return P.strawberrySoft
    default: return P.strawberry
    }
}

private func leafCount(_ stage: String) -> Int {
    switch stage {
    case "seed": return 1
    case "sprout": return 3
    default: return 5
    }
}

private func seedCount(_ stage: String) -> Int {
    switch stage {
    case "seed": return 3
    case "sprout": return 5
    default: return 8
    }
}

private let petLeaves: [Path] = [
    leafPath((110, 68), (98, 46), (102, 26), (110, 14), (118, 26), (122, 46)),
    leafPath((106, 70), (82, 70), (58, 60), (48, 42), (74, 38), (98, 48)),
    leafPath((114, 70), (138, 70), (162, 60), (172, 42), (146, 38), (122, 48)),
    leafPath((104, 72), (78, 80), (54, 78), (40, 64), (62, 56), (90, 58)),
    leafPath((116, 72), (142, 80), (166, 78), (180, 64), (158, 56), (130, 58)),
]

private let petSeeds: [(CGFloat, CGFloat)] = [(58, 146), (164, 146), (84, 180), (136, 180), (110, 200), (66, 106), (154, 106), (110, 104)]

private let eggPath: Path = {
    var p = Path()
    p.move(to: CGPoint(x: 110, y: 18))
    p.addCurve(to: CGPoint(x: 198, y: 148), control1: CGPoint(x: 160, y: 18), control2: CGPoint(x: 198, y: 92))
    p.addCurve(to: CGPoint(x: 110, y: 232), control1: CGPoint(x: 198, y: 202), control2: CGPoint(x: 160, y: 232))
    p.addCurve(to: CGPoint(x: 22, y: 148), control1: CGPoint(x: 60, y: 232), control2: CGPoint(x: 22, y: 202))
    p.addCurve(to: CGPoint(x: 110, y: 18), control1: CGPoint(x: 22, y: 92), control2: CGPoint(x: 60, y: 18))
    p.closeSubpath()
    return p
}()

private func dot(_ ctx: inout GraphicsContext, _ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ color: Color) {
    ctx.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(color))
}

private func oval(_ ctx: inout GraphicsContext, _ x: CGFloat, _ y: CGFloat, _ rx: CGFloat, _ ry: CGFloat, _ color: Color) {
    ctx.fill(Path(ellipseIn: CGRect(x: x - rx, y: y - ry, width: rx * 2, height: ry * 2)), with: .color(color))
}

/// Occhi, guance e bocca per ogni umore del pet. `u` = 1/scala: tiene lo spessore delle linee uguale in ogni stadio.
private func drawPetFace(_ ctx: inout GraphicsContext, mood: String, u: CGFloat) {
    let ink = P.ink
    let line = StrokeStyle(lineWidth: 7 * u, lineCap: .round, lineJoin: .round)
    func cheeks(_ rx: CGFloat = 14, _ ry: CGFloat = 8.5, _ c: Color = P.blush) {
        oval(&ctx, 58, 148, rx, ry, c)
        oval(&ctx, 162, 148, rx, ry, c)
    }
    switch mood {
    case "happy":
        cheeks()
        ctx.stroke(quad((68, 130), (80, 112), (92, 130)), with: .color(ink), style: line)
        ctx.stroke(quad((128, 130), (140, 112), (152, 130)), with: .color(ink), style: line)
        var m = Path()
        m.move(to: CGPoint(x: 94, y: 144))
        m.addQuadCurve(to: CGPoint(x: 126, y: 144), control: CGPoint(x: 110, y: 172))
        m.closeSubpath()
        ctx.fill(m, with: .color(ink))
        oval(&ctx, 110, 159, 8, 4.5, P.strawberrySoft)
    case "love":
        cheeks(15, 9.5, P.strawberrySoft)
        ctx.fill(heartPath(80, 124, 1.3), with: .color(ink))
        ctx.fill(heartPath(140, 124, 1.3), with: .color(ink))
        dot(&ctx, 76, 121, 2.6, P.white)
        dot(&ctx, 136, 121, 2.6, P.white)
        ctx.stroke(quad((99, 146), (110, 160), (121, 146)), with: .color(ink), style: line)
    case "sleepy":
        cheeks()
        ctx.stroke(quad((68, 126), (80, 138), (92, 126)), with: .color(ink), style: line)
        ctx.stroke(quad((128, 126), (140, 138), (152, 126)), with: .color(ink), style: line)
        ctx.stroke(quad((103, 150), (110, 155), (117, 150)), with: .color(ink), style: line)
        var z = Path()
        z.move(to: CGPoint(x: 160, y: 62)); z.addLine(to: CGPoint(x: 174, y: 62)); z.addLine(to: CGPoint(x: 160, y: 78)); z.addLine(to: CGPoint(x: 174, y: 78))
        ctx.stroke(z, with: .color(ink), style: line)
    case "asleep", "away":
        cheeks()
        ctx.stroke(quad((68, 128), (80, 138), (92, 128)), with: .color(ink), style: line)
        ctx.stroke(quad((128, 128), (140, 138), (152, 128)), with: .color(ink), style: line)
        oval(&ctx, 110, 152, 5, 6, ink)
        var z = Path()
        z.move(to: CGPoint(x: 158, y: 66)); z.addLine(to: CGPoint(x: 174, y: 66)); z.addLine(to: CGPoint(x: 158, y: 84)); z.addLine(to: CGPoint(x: 174, y: 84))
        ctx.stroke(z, with: .color(ink), style: line)
        var z2 = Path()
        z2.move(to: CGPoint(x: 182, y: 40)); z2.addLine(to: CGPoint(x: 192, y: 40)); z2.addLine(to: CGPoint(x: 182, y: 52)); z2.addLine(to: CGPoint(x: 192, y: 52))
        ctx.stroke(z2, with: .color(ink), style: StrokeStyle(lineWidth: 5 * u, lineCap: .round, lineJoin: .round))
    case "hungry":
        cheeks()
        dot(&ctx, 80, 128, 8.5, ink)
        dot(&ctx, 140, 128, 8.5, ink)
        dot(&ctx, 77, 125, 3, P.white)
        dot(&ctx, 137, 125, 3, P.white)
        oval(&ctx, 110, 154, 9, 11, ink)
        oval(&ctx, 110, 160, 5, 4, P.strawberrySoft)
        var drop = Path()
        drop.move(to: CGPoint(x: 176, y: 96))
        drop.addCurve(to: CGPoint(x: 176, y: 114), control1: CGPoint(x: 170, y: 106), control2: CGPoint(x: 168, y: 112))
        drop.addCurve(to: CGPoint(x: 176, y: 96), control1: CGPoint(x: 184, y: 112), control2: CGPoint(x: 182, y: 106))
        drop.closeSubpath()
        ctx.fill(drop, with: .color(P.sky))
        ctx.stroke(drop, with: .color(ink), style: StrokeStyle(lineWidth: 5 * u, lineJoin: .round))
    case "waiting":
        cheeks()
        ctx.stroke(quad((66, 108), (76, 100), (90, 104)), with: .color(ink), style: StrokeStyle(lineWidth: 6 * u, lineCap: .round))
        ctx.stroke(quad((130, 104), (144, 100), (154, 108)), with: .color(ink), style: StrokeStyle(lineWidth: 6 * u, lineCap: .round))
        dot(&ctx, 80, 128, 11, ink)
        dot(&ctx, 140, 128, 11, ink)
        dot(&ctx, 84, 123, 4.2, P.white)
        dot(&ctx, 144, 123, 4.2, P.white)
        dot(&ctx, 76, 134, 2, P.white)
        dot(&ctx, 136, 134, 2, P.white)
        ctx.stroke(quad((101, 150), (110, 157), (119, 150)), with: .color(ink), style: line)
    default: // calm
        cheeks()
        dot(&ctx, 80, 126, 9, ink)
        dot(&ctx, 140, 126, 9, ink)
        dot(&ctx, 83.5, 122.5, 3.2, P.white)
        dot(&ctx, 143.5, 122.5, 3.2, P.white)
        ctx.stroke(quad((101, 145), (110, 154), (119, 145)), with: .color(ink), style: line)
    }
}

private func drawEgg(_ ctx: inout GraphicsContext) {
    var sh = ctx
    sh.translateBy(x: 8, y: 8)
    sh.fill(eggPath, with: .color(P.ink))
    ctx.fill(eggPath, with: .color(P.butterSoft))
    ctx.stroke(eggPath, with: .color(P.ink), style: StrokeStyle(lineWidth: 5, lineJoin: .round))
    let spots: [(CGFloat, CGFloat, CGFloat, CGFloat, Color)] = [
        (62, 96, 15, 11, P.strawberry), (156, 72, 11, 8, P.sky), (164, 176, 14, 10, P.leaf), (56, 190, 10, 7, P.butter),
    ]
    for (x, y, rx, ry, c) in spots {
        let r = Path(ellipseIn: CGRect(x: x - rx, y: y - ry, width: rx * 2, height: ry * 2))
        ctx.fill(r, with: .color(c))
        ctx.stroke(r, with: .color(P.ink), lineWidth: 3.2)
    }
    let s = StrokeStyle(lineWidth: 7, lineCap: .round, lineJoin: .round)
    ctx.stroke(quad((70, 140), (82, 152), (94, 140)), with: .color(P.ink), style: s)
    ctx.stroke(quad((126, 140), (138, 152), (150, 140)), with: .color(P.ink), style: s)
    oval(&ctx, 62, 160, 11, 7, P.blush)
    oval(&ctx, 158, 160, 11, 7, P.blush)
    ctx.stroke(quad((102, 164), (110, 169), (118, 164)), with: .color(P.ink), style: s)
}

/// Il pet: `stage` = egg | seed | sprout | berry | big; `mood` = la faccia (egg, asleep, away, love, happy, calm,
/// hungry, waiting, sleepy).
struct PetFigure: View {
    var stage: String = "seed"
    var mood: String = "calm"
    var size: CGFloat = 80

    var body: some View {
        Canvas { ctx, sz in
            let k = sz.width / 220
            ctx.scaleBy(x: k, y: k)
            if stage == "egg" {
                drawEgg(&ctx)
                return
            }
            let s = stageScale(stage)
            let u = 1 / s
            var g = ctx
            g.translateBy(x: 110, y: 228)
            g.scaleBy(x: s, y: s)
            g.translateBy(x: -110, y: -228)
            let border: CGFloat = 14 * u
            let lines = Array(petLeaves.prefix(leafCount(stage)))
            // ombra dura
            var sh = g
            sh.translateBy(x: 5 * u, y: 5 * u)
            sh.stroke(strawberryBody, with: .color(P.ink), style: StrokeStyle(lineWidth: border + 5 * u, lineJoin: .round))
            sh.fill(strawberryBody, with: .color(P.ink))
            for l in lines {
                sh.stroke(l, with: .color(P.ink), style: StrokeStyle(lineWidth: border + 5 * u, lineJoin: .round))
                sh.fill(l, with: .color(P.ink))
            }
            // bordo fustellato
            g.stroke(strawberryBody, with: .color(P.ink), style: StrokeStyle(lineWidth: border + 5 * u, lineJoin: .round))
            for l in lines { g.stroke(l, with: .color(P.ink), style: StrokeStyle(lineWidth: border + 5 * u, lineJoin: .round)) }
            g.stroke(strawberryBody, with: .color(P.white), style: StrokeStyle(lineWidth: border, lineJoin: .round))
            g.fill(strawberryBody, with: .color(P.white))
            for l in lines {
                g.stroke(l, with: .color(P.white), style: StrokeStyle(lineWidth: border, lineJoin: .round))
                g.fill(l, with: .color(P.white))
            }
            // corpo
            g.fill(strawberryBody, with: .color(stageFill(stage)))
            g.stroke(strawberryBody, with: .color(P.ink), style: StrokeStyle(lineWidth: 5 * u, lineJoin: .round))
            for (x, y) in petSeeds.prefix(seedCount(stage)) {
                let c: Color = stage == "seed" ? P.ink : P.strawberryDeep
                g.fill(Path(ellipseIn: CGRect(x: x - 3.4, y: y - 5, width: 6.8, height: 10)), with: .color(c))
            }
            for l in lines {
                g.fill(l, with: .color(P.leaf))
                g.stroke(l, with: .color(P.ink), style: StrokeStyle(lineWidth: 5 * u, lineJoin: .round))
            }
            if stage == "big" {
                var f = g
                f.translateBy(x: 110, y: 28)
                for a in [0.0, 72.0, 144.0, 216.0, 288.0] {
                    var q = f
                    q.rotate(by: .degrees(a))
                    let petal = Path(ellipseIn: CGRect(x: -7, y: -20, width: 14, height: 18))
                    q.fill(petal, with: .color(P.white))
                    q.stroke(petal, with: .color(P.ink), lineWidth: 4 * u)
                }
                let c = Path(ellipseIn: CGRect(x: -6.5, y: -6.5, width: 13, height: 13))
                f.fill(c, with: .color(P.butter))
                f.stroke(c, with: .color(P.ink), lineWidth: 4 * u)
            }
            drawPetFace(&g, mood: mood, u: u)
            if mood == "love" {
                var h1 = ctx
                h1.translateBy(x: 34, y: 70)
                h1.scaleBy(x: 1.2, y: 1.2)
                h1.fill(heartPath(0, 0, 1), with: .color(P.strawberrySoft))
                h1.stroke(heartPath(0, 0, 1), with: .color(P.ink), lineWidth: 3)
                var h2 = ctx
                h2.translateBy(x: 190, y: 52)
                h2.scaleBy(x: 0.9, y: 0.9)
                h2.fill(heartPath(0, 0, 1), with: .color(P.strawberrySoft))
                h2.stroke(heartPath(0, 0, 1), with: .color(P.ink), lineWidth: 3.4)
            }
        }
        .frame(width: size, height: size * 250 / 220)
        .accessibilityHidden(true)
    }
}
