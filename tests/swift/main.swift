import Foundation

// Prova su Linux del codice Swift puro del widget (targets/widget/Model.swift), lanciata da scripts/swift-check.mjs.
// Legge un JSON di ingressi, scrive un JSON di risultati. Il confronto con TypeScript lo fa scripts/swift-check.mjs.
let args = CommandLine.arguments
guard args.count >= 3, let inData = FileManager.default.contents(atPath: args[1]),
      let input = try? JSONSerialization.jsonObject(with: inData) as? [String: Any] else {
    FileHandle.standardError.write("uso: swift-check <ingressi.json> <uscita.json>\n".data(using: .utf8)!)
    exit(2)
}

var out: [String: Any] = [:]

// 1) Ricorrenze
var rec: [Any] = []
for item in (input["recurrence"] as? [[String: Any]]) ?? [] {
    let start = item["start"] as? String
    let todayIso = (item["today"] as? String) ?? ""
    guard let today = parseCivil(todayIso) else { rec.append(NSNull()); continue }
    if let r = nextRecurrence(start: start, today: today) {
        rec.append(["date": r.date.iso, "daysUntil": r.daysUntil, "kind": r.kind.rawValue, "count": r.count, "label": r.label])
    } else {
        rec.append(NSNull())
    }
}
out["recurrence"] = rec

// 2) Giorni insieme
var days: [Any] = []
for item in (input["days"] as? [[String: Any]]) ?? [] {
    if let today = parseCivil(item["today"] as? String), let n = daysTogether(start: item["start"] as? String, today: today) {
        days.append(n)
    } else { days.append(NSNull()) }
}
out["days"] = days

// 3) "X fa"
var ago: [Any] = []
for s in (input["ago"] as? [Double]) ?? [] { ago.append(["ago": agoIt(s), "short": ageShortIt(s)]) }
out["ago"] = ago

// 4) Snapshot (v1, v2, v3 e casi storti)
var snaps: [String: Any] = [:]
for (name, raw) in (input["snapshots"] as? [String: String]) ?? [:] {
    guard let s = Snapshot.parse(raw) else { snaps[name] = NSNull(); continue }
    let enc = JSONEncoder()
    enc.outputFormatting = [.sortedKeys]
    if let d = try? enc.encode(s), let o = try? JSONSerialization.jsonObject(with: d) { snaps[name] = o }
}
out["snapshots"] = snaps

// 5) Date della timeline: ordinate, uniche, entro 12 h + 3 mezzanotti, con le soglie
var tl: [String: Any] = [:]
if let t = input["timeline"] as? [String: Any], let nowMs = t["nowMs"] as? Double {
    let now = Date(timeIntervalSince1970: nowMs / 1000)
    let ds = timelineDates(now: now, updatedAtMs: t["updatedAtMs"] as? Double)
    tl["count"] = ds.count
    tl["sorted"] = zip(ds, ds.dropFirst()).allSatisfy { $0 < $1 }
    tl["first"] = ds.first!.timeIntervalSince1970 * 1000
    tl["offsets"] = ds.map { Int($0.timeIntervalSince(now)) }
}
out["timeline"] = tl

// 6) Pet: bisogni, faccia, testi e "ultima cura" per ogni voce della timeline (stesso calcolo del widget vero)
var petOut: [Any] = []
for item in (input["pet"] as? [[String: Any]]) ?? [] {
    guard let raw = item["snapshot"] as? String, let snap = Snapshot.parse(raw), let nowMs = item["nowMs"] as? Double else { petOut.append(NSNull()); continue }
    let e = FragolinaEntry(date: Date(timeIntervalSince1970: nowMs / 1000), snapshot: snap, group: nil)
    let n = e.petNeeds
    var row: [String: Any] = [
        "hatched": e.petHatched, "stage": e.petStage, "name": e.petNameText, "mood": e.petMood,
        "needs": ["food": n.food, "love": n.love, "energy": n.energy],
        "dots": ["food": petDots(n.food), "love": petDots(n.love), "energy": petDots(n.energy)],
        "say": e.petSay,
    ]
    row["lastLine"] = e.petLastLine ?? NSNull()
    petOut.append(row)
}
out["pet"] = petOut

var petTl: [Any] = []
for item in (input["petTimeline"] as? [[String: Any]]) ?? [] {
    guard let raw = item["snapshot"] as? String, let snap = Snapshot.parse(raw), let nowMs = item["nowMs"] as? Double else { petTl.append(NSNull()); continue }
    let now = Date(timeIntervalSince1970: nowMs / 1000)
    let mids = ((item["midnightsMs"] as? [Double]) ?? []).map { Date(timeIntervalSince1970: $0 / 1000) }
    let ds = petTimelineDates(now: now, snapshot: snap, midnights: mids)
    petTl.append(ds.map { Int(($0.timeIntervalSince1970 * 1000).rounded()) })
}
out["petTimeline"] = petTl

// 7) Decadimento puro (bisogno, tasso, millisecondi)
var dec: [Any] = []
for item in (input["decay"] as? [[Double]]) ?? [] { dec.append(petDecay(Int(item[0]), Int(item[1]), item[2])) }
out["decay"] = dec

// 8) Biglietto: cosa mostra il widget (snapshot + feed del server + orario della voce)
func jsonObject<T: Encodable>(_ v: T) -> Any {
    let enc = JSONEncoder()
    enc.outputFormatting = [.sortedKeys]
    guard let d = try? enc.encode(v), let o = try? JSONSerialization.jsonObject(with: d) else { return NSNull() }
    return o
}
func entryFrom(_ item: [String: Any]) -> FragolinaEntry? {
    guard let raw = item["snapshot"] as? String, let snap = Snapshot.parse(raw), let nowMs = item["nowMs"] as? Double else { return nil }
    let feed = (item["feed"] as? String).flatMap { Feed.parse($0) }
    return FragolinaEntry(date: Date(timeIntervalSince1970: nowMs / 1000), snapshot: snap, group: nil, feed: feed, feedRevoked: (item["revoked"] as? Bool) ?? false)
}
var noteOut: [Any] = []
for item in (input["note"] as? [[String: Any]]) ?? [] {
    guard let e = entryFrom(item) else { noteOut.append(NSNull()); continue }
    var row: [String: Any] = ["state": e.noteDisplay == nil ? "empty" : "note", "minutesLeft": e.noteMinutesLeft]
    row["byLine"] = e.noteByLine ?? NSNull()
    if let n = e.noteDisplay {
        row["note"] = ["id": n.id, "kind": n.kind, "by": n.by, "byName": n.byName, "createdAt": n.createdAt, "expiresAt": n.expiresAt, "content": jsonObject(n.content)] as [String: Any]
    } else { row["note"] = NSNull() }
    noteOut.append(row)
}
out["note"] = noteOut

// 9) Distanza: stato, chilometri, parole e "aggiornata X fa"
var distOut: [Any] = []
for item in (input["distance"] as? [[String: Any]]) ?? [] {
    guard let e = entryFrom(item) else { distOut.append(NSNull()); continue }
    let d = e.distance
    var row: [String: Any] = ["state": d.state, "near": d.near, "big": d.big, "unit": d.unit, "sentence": d.sentence, "stale": d.stale]
    row["km"] = d.km ?? NSNull()
    row["ageText"] = d.ageText ?? NSNull()
    distOut.append(row)
}
out["distance"] = distOut

var geoOut: [Any] = []
for c in (input["geo"] as? [[Int]]) ?? [] {
    let km = haversineKm(c[0], c[1], c[2], c[3])
    let v = distanceView(km)
    geoOut.append(["km": km, "near": v.near, "kmInt": v.km, "big": v.big, "sentence": v.sentence])
}
out["geo"] = geoOut

var noteTl: [Any] = []
for item in (input["noteTimeline"] as? [[String: Any]]) ?? [] {
    guard let nowMs = item["nowMs"] as? Double else { noteTl.append(NSNull()); continue }
    let ds = noteTimelineDates(now: Date(timeIntervalSince1970: nowMs / 1000), expiresAtMs: item["expiresAtMs"] as? Double)
    noteTl.append(ds.map { Int(($0.timeIntervalSince1970 * 1000).rounded()) })
}
out["noteTimeline"] = noteTl
var distTl: [Any] = []
for item in (input["distanceTimeline"] as? [[String: Any]]) ?? [] {
    guard let nowMs = item["nowMs"] as? Double else { distTl.append(NSNull()); continue }
    let ds = distanceTimelineDates(now: Date(timeIntervalSince1970: nowMs / 1000), partnerAtMs: item["partnerAtMs"] as? Double)
    distTl.append(ds.map { Int(($0.timeIntervalSince1970 * 1000).rounded()) })
}
out["distanceTimeline"] = distTl

let data = try! JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
try! data.write(to: URL(fileURLWithPath: args[2]))
