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

let data = try! JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
try! data.write(to: URL(fileURLWithPath: args[2]))
