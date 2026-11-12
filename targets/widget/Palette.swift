import SwiftUI
import CoreText
import UIKit

// Palette "Sticker Book": STESSI valori di src/design/tokens.ts (tests/widgetTokens.test.ts li confronta).
// Una riga per colore, nel formato `static let nome = Color(hex: 0xRRGGBB)`: il test legge proprio queste righe.
extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

enum P {
    static let ink = Color(hex: 0x22121F)
    static let paper = Color(hex: 0xFFF4F6)
    static let strawberry = Color(hex: 0xFF2D55)
    static let strawberryDeep = Color(hex: 0xC4143A)
    static let leaf = Color(hex: 0x2FBF71)
    static let sky = Color(hex: 0x8FD3FF)
    static let butter = Color(hex: 0xFFD84D)
    static let blush = Color(hex: 0xFFC2CF)
    static let white = Color(hex: 0xFFFFFF)
    static let blushSoft = Color(hex: 0xFFE3EA)
    static let skySoft = Color(hex: 0xD9F0FF)
    static let butterSoft = Color(hex: 0xFFF0B3)
    static let leafSoft = Color(hex: 0xC9F0DA)
    static let strawberrySoft = Color(hex: 0xFFB3C1)
}

// MARK: - Font

/// Registra i font inclusi nell'estensione (file TTF nella radice del bundle del widget). `UIAppFonts` li dichiara
/// già in Info.plist; la registrazione esplicita (CoreText, iOS 4+) è una seconda rete di sicurezza nel caso in cui
/// il sistema non li legga per un'estensione. Sicura da richiamare più volte.
enum FontLoader {
    static let files = ["BagelFatOne", "Figtree-SemiBold", "Figtree-Bold", "Figtree-ExtraBold"]

    static let registered: Bool = {
        for name in files {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else { continue }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
        return true
    }()

    static func has(_ postScriptName: String) -> Bool {
        _ = registered
        return UIFont(name: postScriptName, size: 12) != nil
    }

    // Verificati leggendo la tabella `name` dei TTF (KNOWN_ISSUES punto 4).
    static let bagel = "BagelFatOne-Regular"
    static let semi = "Figtree-SemiBold"
    static let bold = "Figtree-Bold"
    static let extra = "Figtree-ExtraBold"

    static let bagelOK: Bool = has(bagel)
    static let semiOK: Bool = has(semi)
    static let boldOK: Bool = has(bold)
    static let extraOK: Bool = has(extra)
}

/// Bagel Fat One. Se il font non c'è: sistema arrotondato `black` (palette e peso restano, cambia il disegno).
func display(_ size: CGFloat) -> Font {
    FontLoader.bagelOK ? .custom(FontLoader.bagel, size: size) : .system(size: size, weight: .black, design: .rounded)
}

/// Figtree (corpo). Se il font non c'è: sistema con lo stesso peso. `.semibold` → SemiBold, `.bold` → Bold,
/// `.heavy`/`.black` → ExtraBold.
func bodyFont(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font {
    switch weight {
    case .heavy, .black:
        return FontLoader.extraOK ? .custom(FontLoader.extra, size: size) : .system(size: size, weight: .heavy)
    case .bold:
        return FontLoader.boldOK ? .custom(FontLoader.bold, size: size) : .system(size: size, weight: .bold)
    default:
        return FontLoader.semiOK ? .custom(FontLoader.semi, size: size) : .system(size: size, weight: .semibold)
    }
}

// MARK: - Adesivo

/// Adesivo: riempimento piatto + contorno 2.5 + ombra dura (copia piena spostata giù-destra, senza blur).
struct StickerBox<Content: View>: View {
    var fill: Color
    var radius: CGFloat = 18
    var offset: CGFloat = 3
    var rotation: Double = 0
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(fill))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).stroke(P.ink, lineWidth: 2.5))
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(P.ink)
                    .offset(x: offset, y: offset)
            )
            .rotationEffect(.degrees(rotation))
    }
}

/// Adesivo tondo (cerchio con contorno e ombra dura): per le "pillole" e i badge.
struct StickerPill: View {
    let text: String
    var fill: Color = P.butter
    var size: CGFloat = 12
    var symbol: String? = nil
    var rotation: Double = 0

    var body: some View {
        StickerBox(fill: fill, radius: 999, offset: 2, rotation: rotation) {
            HStack(spacing: 4) {
                if let symbol {
                    Image(systemName: symbol).font(.system(size: size - 1, weight: .black))
                }
                Text(text).font(bodyFont(size, .heavy)).lineLimit(1).minimumScaleFactor(0.7)
            }
            .foregroundStyle(P.ink)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
        }
    }
}
