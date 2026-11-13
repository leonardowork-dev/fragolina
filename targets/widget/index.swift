import SwiftUI
import WidgetKit

// I widget sono divisi in DUE pacchetti da al massimo 5 (e il pacchetto principale li compone con `.body`).
// Motivo (sessione 5): un solo WidgetBundle con 7 widget aveva il sesto ("Il vostro pet") assente dalla galleria su
// iOS 16.7, mentre i primi cinque comparivano. Il costruttore del WidgetBundle nasce con un limite di 5 elementi:
// restare sotto quel numero in ogni pacchetto evita il problema. Il kind di ogni widget NON cambia.

@main
struct FragolinaWidgetBundle: WidgetBundle {
    var body: some Widget {
        FragolinaHomeWidgets().body
        FragolinaMoreWidgets().body
    }
}

struct FragolinaHomeWidgets: WidgetBundle {
    var body: some Widget {
        MoodWidget()
        PingWidget()
        PetWidget()
        DaysWidget()
        NoteWidget()
    }
}

struct FragolinaMoreWidgets: WidgetBundle {
    var body: some Widget {
        DistanceWidget()
        LockWidget()
        LockMoodWidget()
        FragolinaWidget()
    }
}
