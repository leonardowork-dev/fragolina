import SwiftUI
import WidgetKit

// "Il suo umore": small = la fragola con l'umore di lei; medium = lei e tu, "noi due".

struct MoodSmallView: View {
    let entry: FragolinaEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                StickerBox(fill: moodFill(entry.moodId), radius: 18, offset: 3, rotation: -2) {
                    MoodOrPlaceholder(moodId: entry.moodId, size: 38).padding(4)
                }
                Spacer(minLength: 0)
                if entry.moodId != nil { AgePill(entry: entry, since: entry.moodSinceText) }
            }
            Spacer(minLength: 2)
            Text(entry.moodId == nil ? WS.moodNone : entry.moodLabel)
                .font(display(20)).tracking(-0.4)
                .foregroundStyle(P.ink)
                .lineLimit(2).minimumScaleFactor(0.55)
            Text(entry.partner)
                .font(bodyFont(12, .heavy)).foregroundStyle(P.ink)
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .widgetURL(WidgetLink.home)
    }
}

struct MoodMediumView: View {
    let entry: FragolinaEntry

    var body: some View {
        HStack(spacing: 12) {
            Link(destination: WidgetLink.home) {
                StickerBox(fill: moodFill(entry.moodId), radius: 22, offset: 4, rotation: -1.5) {
                    HStack(spacing: 8) {
                        MoodOrPlaceholder(moodId: entry.moodId, size: 62)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.partnerShort).font(bodyFont(12, .heavy)).foregroundStyle(P.ink)
                                .lineLimit(1).minimumScaleFactor(0.7)
                            Text(entry.moodId == nil ? WS.moodNone : entry.moodLabel)
                                .font(display(18)).tracking(-0.3).foregroundStyle(P.ink)
                                .lineLimit(2).minimumScaleFactor(0.55)
                            if entry.isSoftStale {
                                Text(entry.updatedText).font(bodyFont(10, .semibold)).foregroundStyle(P.ink)
                                    .lineLimit(1).minimumScaleFactor(0.7)
                            } else if entry.moodId != nil, let since = entry.moodSinceText {
                                Text(since).font(bodyFont(11, .semibold)).foregroundStyle(P.ink).lineLimit(1)
                            } else {
                                Text(WS.moodNoneHint).font(bodyFont(10, .semibold)).foregroundStyle(P.ink)
                                    .lineLimit(2).minimumScaleFactor(0.8)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(8)
                }
            }
            .frame(maxWidth: .infinity)
            Link(destination: WidgetLink.mood) {
                StickerBox(fill: entry.myMoodId == nil ? P.skySoft : moodFill(entry.myMoodId), radius: 18, offset: 3, rotation: 1.5) {
                    VStack(spacing: 1) {
                        MoodOrPlaceholder(moodId: entry.myMoodId, size: 38)
                        Text(entry.meShort).font(bodyFont(11, .heavy)).foregroundStyle(P.ink)
                            .lineLimit(1).minimumScaleFactor(0.6)
                        Text(entry.myMoodId == nil ? WS.youNone : entry.myMoodLabel)
                            .font(bodyFont(10, .semibold)).foregroundStyle(P.ink)
                            .lineLimit(1).minimumScaleFactor(0.6)
                    }
                    .padding(.vertical, 8).padding(.horizontal, 6)
                    .frame(width: 88)
                }
            }
        }
    }
}

struct MoodWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FragolinaEntry

    var body: some View {
        let medium = family == .systemMedium
        Group {
            if entry.state != .ok {
                SleepyView(entry: entry, compact: !medium)
            } else if medium {
                MoodMediumView(entry: entry)
            } else {
                MoodSmallView(entry: entry)
            }
        }
        .stickerWidgetBackground()
    }
}

struct MoodWidget: Widget {
    let kind = "FragolinaMood"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FragolinaProvider()) { entry in
            MoodWidgetView(entry: entry)
        }
        .configurationDisplayName(WS.moodName)
        .description(WS.moodDesc)
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
