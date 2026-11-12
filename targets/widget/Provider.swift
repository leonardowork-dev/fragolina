import SwiftUI
import WidgetKit

extension FragolinaEntry: TimelineEntry {}

/// Un solo provider per tutti i widget: legge il JSON dall'App Group (gruppo risolto a runtime) e prepara le voci.
/// Nessuna rete (Percorso A confermato sul telefono). Date delle voci: vedi `timelineDates` in Model.swift.
struct FragolinaProvider: TimelineProvider {
    func placeholder(in context: Context) -> FragolinaEntry {
        let nowMs = Date().timeIntervalSince1970 * 1000
        return FragolinaEntry(
            date: Date(),
            snapshot: Snapshot(
                v: 3, updatedAt: nowMs, paired: true, partnerName: "Nikole", moodId: "innamorata", moodLabel: "Innamorata",
                moodAt: nowMs - 2 * 3600 * 1000, thinkingToday: 3, pingsReceived: 41, lastPingAt: nowMs - 10 * 60 * 1000,
                startDate: "2025-02-14", myName: "Leonardo", myMoodId: "carica", myMoodLabel: "Carica",
                myMoodAt: nowMs - 5 * 3600 * 1000, questionText: nil, questionMineDone: nil, questionBothDone: nil
            ),
            group: nil
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (FragolinaEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : load(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FragolinaEntry>) -> Void) {
        let now = Date()
        let base = load(at: now)
        let entries = timelineDates(now: now, updatedAtMs: base.snapshot?.updatedAt).map {
            FragolinaEntry(date: $0, snapshot: base.snapshot, group: base.group)
        }
        // Rilegge il JSON ogni ora anche senza che l'app lo chieda (l'app comunque ricarica a ogni cambio).
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(60 * 60))))
    }

    private func load(at date: Date) -> FragolinaEntry {
        let group = GroupResolver.resolve()
        var snap: Snapshot?
        if let group,
           let raw = UserDefaults(suiteName: group)?.string(forKey: GroupResolver.payloadKey) {
            snap = Snapshot.parse(raw)
        }
        return FragolinaEntry(date: date, snapshot: snap, group: group)
    }
}
