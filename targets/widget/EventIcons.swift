import Foundation

// GENERATO da scripts/gen-event-icons.mjs a partire da src/lib/countdown/icons.json: non modificarlo a mano.
// Simboli del conto alla rovescia su una griglia 100×100 (soli comandi M L C Z assoluti). Solo Foundation.
enum EventIconData {
    /// icona → elenco di forme (tracciato, nome del colore della palette o "none"), dal fondo verso l'alto.
    static let shapes: [String: [(d: String, fill: String)]] = [
        "heart": [
            (d: "M50 88 C20 66 8 48 8 32 C8 18 19 10 30 10 C40 10 47 16 50 24 C53 16 60 10 70 10 C81 10 92 18 92 32 C92 48 80 66 50 88 Z", fill: "strawberry"),
        ],
        "plane": [
            (d: "M8 46 L92 12 L66 88 L48 58 Z", fill: "sky"),
            (d: "M92 12 L48 58 L46 78 L36 64", fill: "none"),
        ],
        "ticket": [
            (d: "M10 28 L90 28 L90 42 C82 42 82 58 90 58 L90 72 L10 72 L10 58 C18 58 18 42 10 42 Z", fill: "butter"),
            (d: "M66 30 L66 40 M66 47 L66 53 M66 60 L66 70", fill: "none"),
        ],
        "cake": [
            (d: "M16 52 L84 52 L84 86 L16 86 Z", fill: "blush"),
            (d: "M16 52 L84 52 L84 62 C76 70 70 70 62 62 C54 70 46 70 38 62 C30 70 24 70 16 62 Z", fill: "strawberry"),
            (d: "M46 30 L54 30 L54 50 L46 50 Z", fill: "sky"),
            (d: "M50 10 C58 18 58 26 50 30 C42 26 42 18 50 10 Z", fill: "butter"),
        ],
        "gift": [
            (d: "M14 42 L86 42 L86 88 L14 88 Z", fill: "strawberry"),
            (d: "M10 30 L90 30 L90 42 L10 42 Z", fill: "blush"),
            (d: "M44 30 L56 30 L56 88 L44 88 Z", fill: "butter"),
            (d: "M50 30 C32 6 16 20 30 30 Z", fill: "butter"),
            (d: "M50 30 C68 6 84 20 70 30 Z", fill: "butter"),
        ],
        "sun": [
            (d: "M50 8 L50 20 M50 80 L50 92 M8 50 L20 50 M80 50 L92 50 M20 20 L28 28 M72 72 L80 80 M80 20 L72 28 M28 72 L20 80", fill: "none"),
            (d: "M72 50 C72 62 62 72 50 72 C38 72 28 62 28 50 C28 38 38 28 50 28 C62 28 72 38 72 50 Z", fill: "butter"),
        ],
        "star": [
            (d: "M50 8 L61 36 L92 38 L68 57 L76 88 L50 71 L24 88 L32 57 L8 38 L39 36 Z", fill: "butter"),
        ],
        "house": [
            (d: "M8 48 L50 12 L92 48 L82 48 L82 88 L18 88 L18 48 Z", fill: "sky"),
            (d: "M42 88 L42 62 L58 62 L58 88 Z", fill: "strawberry"),
        ],
        "train": [
            (d: "M20 14 L80 14 C86 14 90 18 90 24 L90 70 L10 70 L10 24 C10 18 14 14 20 14 Z", fill: "leaf"),
            (d: "M20 26 L80 26 L80 46 L20 46 Z", fill: "paper"),
            (d: "M37 80 C37 84 34 87 30 87 C26 87 23 84 23 80 C23 76 26 73 30 73 C34 73 37 76 37 80 Z", fill: "ink"),
            (d: "M77 80 C77 84 74 87 70 87 C66 87 63 84 63 80 C63 76 66 73 70 73 C74 73 77 76 77 80 Z", fill: "ink"),
        ],
        "balloon": [
            (d: "M50 8 C74 8 84 26 84 42 C84 62 66 76 50 78 C34 76 16 62 16 42 C16 26 26 8 50 8 Z", fill: "strawberry"),
            (d: "M44 78 L56 78 L50 86 Z", fill: "strawberry"),
            (d: "M50 86 C42 91 58 95 50 99", fill: "none"),
        ],
    ]
}
