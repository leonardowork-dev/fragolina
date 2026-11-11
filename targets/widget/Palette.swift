import SwiftUI

// Palette "Sticker Book" (stessi valori di src/design/tokens.ts).
enum P {
    static let ink = Color(red: 0x22 / 255, green: 0x12 / 255, blue: 0x1F / 255)
    static let paper = Color(red: 1, green: 0xF4 / 255, blue: 0xF6 / 255)
    static let strawberry = Color(red: 1, green: 0x2D / 255, blue: 0x55 / 255)
    static let strawberrySoft = Color(red: 1, green: 0xB3 / 255, blue: 0xC1 / 255)
    static let leaf = Color(red: 0x2F / 255, green: 0xBF / 255, blue: 0x71 / 255)
    static let sky = Color(red: 0x8F / 255, green: 0xD3 / 255, blue: 1)
    static let skySoft = Color(red: 0xD9 / 255, green: 0xF0 / 255, blue: 1)
    static let butter = Color(red: 1, green: 0xD8 / 255, blue: 0x4D / 255)
    static let butterSoft = Color(red: 1, green: 0xF0 / 255, blue: 0xB3 / 255)
    static let blush = Color(red: 1, green: 0xC2 / 255, blue: 0xCF / 255)
    static let blushSoft = Color(red: 1, green: 0xE3 / 255, blue: 0xEA / 255)
}

// Bagel Fat One se il font è stato caricato dal target (UIAppFonts); altrimenti SwiftUI usa il font di
// sistema con peso black: palette e peso restano, cambia solo il disegno delle lettere.
func display(_ size: CGFloat) -> Font {
    .custom("BagelFatOne-Regular", size: size)
}

func body(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font {
    .system(size: size, weight: weight, design: .default)
}

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
