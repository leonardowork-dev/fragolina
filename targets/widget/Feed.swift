import Foundation

// PERCORSO B: il widget scarica da solo il "feed" da Supabase (biglietto attivo + posizione di lei).
// Una sola chiamata, `POST /rest/v1/rpc/widget_feed`, con la chiave PUBBLICA e il token del widget (nello snapshot:
// feedUrl / feedKey / feedToken). Mai la chiave segreta di amministrazione, mai la sessione dell'app. Timeout breve (8 s); se fallisce si
// usa l'ultimo feed buono (cache nel processo del widget) o, in mancanza, lo snapshot dell'app (Percorso A).
// Questo è l'UNICO file del widget che usa la rete (tests/widgetSwift.test.ts lo controlla).

private struct FeedCache: Codable {
    var token: String
    var feed: Feed
}

enum FeedClient {
    static let cacheKey = "fragolina.feed.cache.v1"
    static let timeout: TimeInterval = 8
    /// Due widget (biglietto + distanza) si ricaricano insieme: la seconda richiesta riusa la risposta di meno di 60 s.
    static let reuseMs: Double = 60_000
    /// Un feed vecchio più di 6 h non si usa più al posto dello snapshot.
    static let keepMs: Double = 6 * 3600 * 1000

    private enum Outcome {
        case ok(Feed)
        case revoked
        case failed
    }

    /// Restituisce (feed, revocato). `feed == nil && !revocato` = niente da dire: usa lo snapshot.
    static func resolve(snapshot: Snapshot?, completion: @escaping (Feed?, Bool) -> Void) {
        guard let s = snapshot,
              let base = s.feedUrl, !base.isEmpty,
              let key = s.feedKey, !key.isEmpty,
              let token = s.feedToken, !token.isEmpty,
              let url = URL(string: base.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/rest/v1/rpc/widget_feed")
        else { completion(nil, false); return }

        let nowMs = Date().timeIntervalSince1970 * 1000
        let cached = loadCache(token: token)
        if let c = cached, let at = c.fetchedAt, nowMs - at >= 0, nowMs - at < reuseMs {
            completion(c, false)
            return
        }
        fetch(url: url, key: key, token: token) { outcome in
            switch outcome {
            case .ok(let f):
                saveCache(f, token: token)
                completion(f, false)
            case .revoked:
                clearCache()
                completion(nil, true)
            case .failed:
                // rete assente o server lento: l'ultimo feed buono, ma solo se è più fresco di quello che sa l'app
                if let c = cached, let at = c.fetchedAt, at > (s.updatedAt ?? 0), nowMs - at < keepMs {
                    completion(c, false)
                } else {
                    completion(nil, false)
                }
            }
        }
    }

    private static func fetch(url: URL, key: String, token: String, done: @escaping (Outcome) -> Void) {
        var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeout)
        req.httpMethod = "POST"
        req.setValue(key, forHTTPHeaderField: "apikey")
        // Le chiavi "anon" vecchie sono JWT e vanno anche come Bearer; le nuove "sb_publishable_…" non sono JWT.
        if key.hasPrefix("eyJ") { req.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization") }
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["p_token": token])

        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = timeout
        cfg.timeoutIntervalForResource = timeout
        cfg.waitsForConnectivity = false
        let session = URLSession(configuration: cfg)
        session.dataTask(with: req) { data, resp, err in
            session.finishTasksAndInvalidate()
            guard err == nil, let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode), let data else {
                done(.failed)
                return
            }
            if let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any], (o["ok"] as? Bool) == false {
                done((o["error"] as? String) == "invalid_token" ? .revoked : .failed)
                return
            }
            guard var feed = Feed.parse(data) else {
                done(.failed)
                return
            }
            feed.fetchedAt = Date().timeIntervalSince1970 * 1000
            done(.ok(feed))
        }.resume()
    }

    // ---- cache (UserDefaults.standard del processo del widget: esiste anche senza App Group) ----

    private static func loadCache(token: String) -> Feed? {
        guard let raw = UserDefaults.standard.data(forKey: cacheKey),
              let c = try? JSONDecoder().decode(FeedCache.self, from: raw), c.token == token else { return nil }
        return c.feed
    }

    private static func saveCache(_ feed: Feed, token: String) {
        if let raw = try? JSONEncoder().encode(FeedCache(token: token, feed: feed)) {
            UserDefaults.standard.set(raw, forKey: cacheKey)
        }
    }

    private static func clearCache() {
        UserDefaults.standard.removeObject(forKey: cacheKey)
    }
}
