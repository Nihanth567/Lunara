import WidgetKit
import SwiftUI

// Mirrors APP_GROUP in expo-target.config.js — keep in sync.
private let appGroup = "group.com.lunara.app.widget"

private let backgroundTop = Color(red: 0.06, green: 0.05, blue: 0.16)
private let backgroundBottom = Color(red: 0.16, green: 0.09, blue: 0.30)
private let lavender = Color(red: 0.76, green: 0.69, blue: 0.88)
private let mutedLavender = Color(red: 0.48, green: 0.43, blue: 0.60)
private let softGreen = Color(red: 0.66, green: 0.85, blue: 0.66)

struct LunaraStreakEntry: TimelineEntry {
    let date: Date
    let streak: Int
    let ritualComplete: Bool
    let isPaired: Bool
}

struct LunaraStreakProvider: TimelineProvider {
    func placeholder(in context: Context) -> LunaraStreakEntry {
        LunaraStreakEntry(date: Date(), streak: 7, ritualComplete: false, isPaired: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (LunaraStreakEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LunaraStreakEntry>) -> Void) {
        let entry = currentEntry()
        // The app pushes fresh data via ExtensionStorage.reloadWidget() after every
        // submit/sync, so the timeline only needs a daily safety-net refresh to keep
        // the "tonight" framing correct across midnight.
        let nextRefresh = Calendar.current.nextDate(
            after: Date(),
            matching: DateComponents(hour: 0, minute: 5),
            matchingPolicy: .nextTime
        ) ?? Date().addingTimeInterval(6 * 3600)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }

    private func currentEntry() -> LunaraStreakEntry {
        let defaults = UserDefaults(suiteName: appGroup)
        return LunaraStreakEntry(
            date: Date(),
            streak: defaults?.integer(forKey: "streak") ?? 0,
            ritualComplete: defaults?.bool(forKey: "ritualComplete") ?? false,
            isPaired: defaults?.bool(forKey: "isPaired") ?? false
        )
    }
}

struct LunaraStreakWidgetView: View {
    var entry: LunaraStreakProvider.Entry

    private var moonSymbol: String {
        entry.streak >= 14 ? "moon.stars.fill" : "moon.stars"
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [backgroundTop, backgroundBottom], startPoint: .top, endPoint: .bottom)

            if !entry.isPaired {
                VStack(spacing: 8) {
                    Image(systemName: "moon.stars")
                        .font(.system(size: 20))
                        .foregroundStyle(lavender)
                    Text("Open Lunara to connect with your partner")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(mutedLavender)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                }
                .padding(16)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Image(systemName: moonSymbol)
                            .font(.system(size: 15))
                            .foregroundStyle(lavender)
                        Text("LUNARA")
                            .font(.system(size: 11, weight: .semibold))
                            .tracking(1.4)
                            .foregroundStyle(lavender)
                    }

                    Spacer(minLength: 4)

                    Text("\(entry.streak)")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text(entry.streak == 1 ? "night together" : "nights together")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(mutedLavender)

                    Spacer(minLength: 4)

                    Text(entry.ritualComplete ? "Tonight is complete 🌙" : "Tonight's ritual is waiting")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(entry.ritualComplete ? softGreen : mutedLavender)
                        .lineLimit(2)
                }
                .padding(16)
            }
        }
    }
}

struct LunaraStreakWidget: Widget {
    let kind: String = "LunaraStreakWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LunaraStreakProvider()) { entry in
            LunaraStreakWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color.clear }
        }
        .configurationDisplayName("Lunara Streak")
        .description("A quiet glance at your nightly streak.")
        .supportedFamilies([.systemSmall])
    }
}

#Preview(as: .systemSmall) {
    LunaraStreakWidget()
} timeline: {
    LunaraStreakEntry(date: .now, streak: 7, ritualComplete: true, isPaired: true)
    LunaraStreakEntry(date: .now, streak: 0, ritualComplete: false, isPaired: false)
}
