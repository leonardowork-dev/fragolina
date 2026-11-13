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

    func load(at date: Date) -> FragolinaEntry {
        let group = GroupResolver.resolve()
        var snap: Snapshot?
        if let group,
           let raw = UserDefaults(suiteName: group)?.string(forKey: GroupResolver.payloadKey) {
            snap = Snapshot.parse(raw)
        }
        return FragolinaEntry(date: date, snapshot: snap, group: group)
    }
}

/// Provider del pet: voci ogni ora per 24 h (+ istanti esatti), così la faccia cambia anche con l'app chiusa.
/// Ogni voce porta lo stesso snapshot: i bisogni si ricalcolano per la data della voce (`FragolinaEntry.petNeeds`).
struct PetProvider: TimelineProvider {
    func placeholder(in context: Context) -> FragolinaEntry {
        let nowMs = Date().timeIntervalSince1970 * 1000
        return FragolinaEntry(
            date: Date(),
            snapshot: Snapshot(
                v: 4, updatedAt: nowMs, paired: true, partnerName: "Nikole", myName: "Leonardo",
                petHatched: true, petStage: "sprout", petName: "Bacca", petFood: 640, petLove: 820, petEnergy: 600,
                petAt: nowMs, petSleepUntil: 0, petLastAt: nowMs - 30 * 60 * 1000, petDay: "", petBoth: false,
                petLastBy: "partner", petLastKind: "feed", petLastItem: "mora"
            ),
            group: nil
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (FragolinaEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : FragolinaProvider().load(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FragolinaEntry>) -> Void) {
        let now = Date()
        let base = FragolinaProvider().load(at: now)
        var dates = petTimelineDates(now: now, snapshot: base.snapshot, midnights: nextMidnights(after: now, count: 2))
        // anche le soglie "dati vecchi" (3 h) e "dorme" (48 h) dall'ultimo aggiornamento, come negli altri widget
        if let ms = base.snapshot?.updatedAt, ms > 0 {
            let at = Date(timeIntervalSince1970: ms / 1000)
            for t in [softStaleAfter + 1, hardStaleAfter + 1] {
                let d = at.addingTimeInterval(t)
                if d > now && d <= now.addingTimeInterval(24 * 3600) { dates.append(d) }
            }
            dates.sort()
        }
        let entries = dates.map { FragolinaEntry(date: $0, snapshot: base.snapshot, group: base.group) }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(60 * 60))))
    }
}
