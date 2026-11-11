import ExpoModulesCore
import WidgetKit

public class GroupResolverModule: Module {
    public func definition() -> ModuleDefinition {
        Name("GroupResolver")

        // Gruppo usabile (nil se il sistema non concede alcun container).
        Function("resolveGroupId") { () -> String? in
            GroupResolver.resolve()
        }

        // Tutti i candidati provati, per diagnostica.
        Function("candidates") { () -> [String] in
            GroupResolver.candidates()
        }

        // Scrive il payload JSON nel gruppo risolto. Ritorna il gruppo usato o nil se fallisce.
        Function("writePayload") { (json: String) -> String? in
            guard let group = GroupResolver.resolve(),
                  let defaults = UserDefaults(suiteName: group) else { return nil }
            defaults.set(json, forKey: GroupResolver.payloadKey)
            return group
        }

        // Rilegge ciò che il widget vedrebbe (verifica end-to-end dal lato app).
        Function("readPayload") { () -> String? in
            guard let group = GroupResolver.resolve(),
                  let defaults = UserDefaults(suiteName: group) else { return nil }
            return defaults.string(forKey: GroupResolver.payloadKey)
        }

        Function("reloadWidgets") { () in
            if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
        }
    }
}
