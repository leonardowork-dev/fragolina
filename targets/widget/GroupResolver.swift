import Foundation

/// Trova il App Group davvero utilizzabile a runtime.
/// I tool di sideloading con Apple ID gratuito possono riscrivere bundle id e group id (es. suffisso del Team ID),
/// quindi NON si usa mai un id fisso. Si provano, in ordine:
///  1. i gruppi presenti nel provisioning profile embedded (quelli davvero concessi),
///  2. la chiave Info.plist `ALTAppGroups` (AltStore),
///  3. qualsiasi stringa `group.*` trovata in Info.plist (altri tool),
///  4. il gruppo di base (valore di build, `FragolinaBaseAppGroup` in Info.plist).
/// Il primo per cui il sistema concede un container vince.
/// NOTA: file duplicato in targets/widget/GroupResolver.swift (stessa logica). Tienili allineati.
enum GroupResolver {
    static let fallbackGroup = "group.app.fragolina.couple"
    static let payloadKey = "payload"

    static func baseGroup() -> String {
        (Bundle.main.object(forInfoDictionaryKey: "FragolinaBaseAppGroup") as? String) ?? fallbackGroup
    }

    static func infoPlistGroups() -> [String] {
        var out: [String] = []
        if let arr = Bundle.main.object(forInfoDictionaryKey: "ALTAppGroups") as? [String] {
            out += arr
        }
        for (_, value) in Bundle.main.infoDictionary ?? [:] {
            if let s = value as? String, s.hasPrefix("group.") { out.append(s) }
            if let a = value as? [String] { out += a.filter { $0.hasPrefix("group.") } }
        }
        return out
    }

    /// Il plist del provisioning profile embedded (la parte XML in mezzo alla firma). `nil` se manca (build non sideload).
    static func provisionPlist() -> [String: Any]? {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8)),
              start.lowerBound < end.upperBound
        else { return nil }
        let plistData = data.subdata(in: start.lowerBound..<end.upperBound)
        return try? PropertyListSerialization.propertyList(from: plistData, options: [], format: nil) as? [String: Any]
    }

    static func provisionGroups() -> [String] {
        guard let obj = provisionPlist(),
              let ent = obj["Entitlements"] as? [String: Any],
              let groups = ent["com.apple.security.application-groups"] as? [String]
        else { return [] }
        return groups
    }

    /// Scadenza del provisioning profile (con un Apple ID gratuito: 7 giorni dopo la firma), in millisecondi da epoch.
    /// `nil` se non c'è il profilo o non si legge la data. Nessuna API iOS 17+.
    static func provisionExpiryMs() -> Double? {
        guard let d = provisionPlist()?["ExpirationDate"] as? Date else { return nil }
        return d.timeIntervalSince1970 * 1000
    }

    static func candidates() -> [String] {
        var out: [String] = []
        out += provisionGroups()
        out += infoPlistGroups()
        out.append(baseGroup())
        var seen = Set<String>()
        return out.filter { $0 != "*" && seen.insert($0).inserted }
    }

    /// Primo gruppo per cui il sistema concede davvero un container.
    static func resolve() -> String? {
        candidates().first {
            FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: $0) != nil
        }
    }
}
