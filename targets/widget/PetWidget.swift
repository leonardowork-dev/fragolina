import SwiftUI
import WidgetKit

// "Il vostro pet": small = il pet con la faccia di adesso + tre pallini dei bisogni; medium = pet grande, nome, cosa
// dice, i tre bisogni e l'ultima cura; accessoryRectangular (schermata di blocco) = nome, cosa dice, tre simboli.
// La faccia e i bisogni si ricalcolano per OGNI voce della timeline (PetProvider), anche con l'app chiusa.

/// Un bisogno come pallino adesivo: pieno = ok, chiaro = così così, fragola = si fa sentire.
struct NeedDot: View {
    let full: Color
    let soft: Color
    let level: Int
    var size: CGFloat = 14

    var body: some View {
        Circle()
            .fill(level >= 3 ? full : (level == 2 ? soft : P.strawberry))
            .overlay(Circle().stroke(P.ink, lineWidth: 2))
            .frame(width: size, height: size)
    }
}

struct PetNeedDots: View {
    let entry: FragolinaEntry

    var body: some View {
        VStack(spacing: 4) {
            NeedDot(full: P.butter, soft: P.butterSoft, level: petDots(entry.petNeeds.food))
            NeedDot(full: P.blush, soft: P.blushSoft, level: petDots(entry.petNeeds.love))
            NeedDot(full: P.sky, soft: P.skySoft, level: petDots(entry.petNeeds.energy))
        }
    }
}

/// Un bisogno con la sua etichetta e tre pallini (1-3 pieni): per il widget medio.
struct NeedChip: View {
    let label: String
    let fill: Color
    let level: Int

    var body: some View {
        StickerBox(fill: fill, radius: 12, offset: 2, rotation: 0) {
            VStack(spacing: 2) {
                Text(label).font(bodyFont(10, .heavy)).foregroundStyle(P.ink).lineLimit(1).minimumScaleFactor(0.7)
                HStack(spacing: 3) {
                    ForEach(0..<3, id: \.self) { i in
                        Circle()
                            .fill(i < level ? (level == 1 ? P.strawberry : P.ink) : P.paper)
                            .overlay(Circle().stroke(P.ink, lineWidth: 1.5))
                            .frame(width: 7, height: 7)
                    }
                }
            }
            .padding(.vertical, 4).padding(.horizontal, 6)
            .frame(maxWidth: .infinity)
        }
    }
}

private func petPanelFill(_ mood: String) -> Color {
    mood == "asleep" || mood == "away" ? P.ink : P.skySoft
}

struct PetSmallView: View {
    let entry: FragolinaEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 0) {
                PetFigure(stage: entry.petStage, mood: entry.petMood, size: 60)
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 5) {
                    if entry.isSoftStale { AgePill(entry: entry) }
                    if entry.petHatched { PetNeedDots(entry: entry) }
                }
            }
            Spacer(minLength: 2)
            Text(entry.petHatched ? entry.petNameText : WS.petEggTitle)
                .font(display(19)).tracking(-0.4)
                .foregroundStyle(P.ink)
                .lineLimit(1).minimumScaleFactor(0.55)
            Text(entry.petSay)
                .font(bodyFont(12, .heavy)).foregroundStyle(P.ink)
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .widgetURL(WidgetLink.pet)
    }
}

struct PetMediumView: View {
    let entry: FragolinaEntry

    var body: some View {
        HStack(spacing: 12) {
            StickerBox(fill: petPanelFill(entry.petMood), radius: 22, offset: 4, rotation: -1.5) {
                PetFigure(stage: entry.petStage, mood: entry.petMood, size: 66)
                    .padding(.horizontal, 10).padding(.vertical, 6)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.petHatched ? entry.petNameText : WS.petEggTitle)
                    .font(display(24)).tracking(-0.4).foregroundStyle(P.ink)
                    .lineLimit(1).minimumScaleFactor(0.5)
                Text(entry.petSay)
                    .font(bodyFont(13, .heavy)).foregroundStyle(P.ink)
                    .lineLimit(1).minimumScaleFactor(0.7)
                if entry.petHatched {
                    HStack(spacing: 4) {
                        NeedChip(label: WS.petNeedFood, fill: P.butter, level: petDots(entry.petNeeds.food))
                        NeedChip(label: WS.petNeedLove, fill: P.blush, level: petDots(entry.petNeeds.love))
                        NeedChip(label: WS.petNeedEnergy, fill: P.sky, level: petDots(entry.petNeeds.energy))
                    }
                    .padding(.trailing, 3)
                }
                if entry.isSoftStale {
                    Text(entry.updatedText).font(bodyFont(10, .semibold)).foregroundStyle(P.ink)
                        .lineLimit(1).minimumScaleFactor(0.7)
                } else if let last = entry.petLastLine {
                    Text(last).font(bodyFont(10, .semibold)).foregroundStyle(P.ink)
                        .lineLimit(1).minimumScaleFactor(0.65)
                }
            }
            Spacer(minLength: 0)
        }
        .widgetURL(WidgetLink.pet)
    }
}

/// Schermata di blocco: nome, cosa dice, tre simboli (opacità = quanto sta bene).
struct PetRectContent: View {
    let entry: FragolinaEntry

    private func op(_ v: Int) -> Double { petDots(v) >= 3 ? 1 : (petDots(v) == 2 ? 0.6 : 0.3) }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(entry.petHatched ? entry.petNameText : WS.petEggTitle)
                .font(.system(size: 14, weight: .bold)).lineLimit(1)
            Text(entry.petSay)
                .font(.system(size: 12, weight: .semibold)).lineLimit(1)
            if entry.petHatched {
                HStack(spacing: 10) {
                    Image(systemName: "fork.knife").opacity(op(entry.petNeeds.food))
                    Image(systemName: "heart.fill").opacity(op(entry.petNeeds.love))
                    Image(systemName: "moon.fill").opacity(op(entry.petNeeds.energy))
                }
                .font(.system(size: 12, weight: .semibold))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct PetLockView: View {
    let entry: FragolinaEntry

    var body: some View {
        if entry.state != .ok {
            LockSleepy(entry: entry)
        } else {
            PetRectContent(entry: entry)
                .widgetURL(WidgetLink.pet)
                .accessoryWidgetBackgroundCompat()
        }
    }
}

struct PetHomeView: View {
    let entry: FragolinaEntry
    let medium: Bool

    var body: some View {
        Group {
            if entry.state != .ok {
                SleepyView(entry: entry, compact: !medium)
            } else if medium {
                PetMediumView(entry: entry)
            } else {
                PetSmallView(entry: entry)
            }
        }
        .stickerWidgetBackground()
    }
}

struct PetWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        if family == .accessoryRectangular {
            PetLockView(entry: entry)
        } else {
            PetHomeView(entry: entry, medium: family == .systemMedium)
        }
    }
}

struct PetWidget: Widget {
    let kind = "FragolinaPet"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PetProvider()) { entry in
            PetWidgetView(entry: entry)
        }
        .configurationDisplayName(WS.petGalleryName)
        .description(WS.petGalleryDesc)
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}
