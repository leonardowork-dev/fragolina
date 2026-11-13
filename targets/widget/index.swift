import SwiftUI
import WidgetKit

@main
struct FragolinaWidgetBundle: WidgetBundle {
    var body: some Widget {
        MoodWidget()
        PingWidget()
        DaysWidget()
        LockWidget()
        LockMoodWidget()
        PetWidget()
        FragolinaWidget()
    }
}
