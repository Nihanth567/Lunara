import WidgetKit
import SwiftUI

// Mirrors APP_GROUP in expo-target.config.js — keep in sync.
private let appGroup = "group.com.lunara.app.widget"

private let backgroundTop = Color(red: 0.06, green: 0.05, blue: 0.16)
private let backgroundBottom = Color(red: 0.16, green: 0.09, blue: 0.30)
private let lavender = Color(red: 0.76, green: 0.69, blue: 0.88)
private let mutedLavender = Color(red: 0.48, green: 0.43, blue: 0.60)
private let softGreen = Color(red: 0.66, green: 0.85, blue: 0.66)
private let amber = Color(red: 1.00, green: 0.84, blue: 0.65)

/// Mirrors `WidgetStatus` in lib/widget.ts.
enum LunaraStatus: String {
    case unpaired
    case open
    case waiting
    case ready
    case complete

    /// A named factory rather than an `init(rawValue:)` overload: adding an
    /// optional-taking initialiser alongside the synthesised `init?(rawValue:)`
    /// makes every call site ambiguous.
    static func from(_ raw: String?) -> LunaraStatus {
        guard let raw, let status = LunaraStatus(rawValue: raw) else { return .open }
        return status
    }
}

/// Mirrors `CompanionState` in lib/companion.ts.
///
/// The mood only — the widget never draws the companion's copy, its streak tier
/// or its specks. A home screen gets one glance, and the glance is "is it lit".
enum LunaraCompanion: String {
    case nesting
    case waiting
    case ready
    case glowing
    case streaklit
    case resting
    case sleeping

    static func from(_ raw: String?) -> LunaraCompanion {
        guard let raw, let mood = LunaraCompanion(rawValue: raw) else { return .nesting }
        return mood
    }
}

struct LunaraStreakEntry: TimelineEntry {
    let date: Date
    let streak: Int
    let status: LunaraStatus
    let atRisk: Bool
    let streakProtected: Bool
    let companion: LunaraCompanion
}

/// One ear. Mirrored for the pair so the two can never drift apart under an edit.
struct LunaraEar: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.midX + rect.width * 0.18, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

/// The couple's companion, reduced to a mark.
///
/// A deliberate simplification of `components/NightFoxArt.tsx` rather than a
/// port of it: a head, two ears, a halo, and — for the half-finished night —
/// the small warm light. Everything that needs real drawing (the tail, the
/// ruff, the streak specks, the commissioned art itself) is dropped, because
/// none of it survives being 20 points wide on a home screen anyway.
///
/// Mood changes posture and temperature, never presence. There is no state in
/// which this mark is absent or dark.
struct CompanionMark: View {
    let mood: LunaraCompanion
    var size: CGFloat = 20

    /// 1 = sitting up, ears forward. 0 = curled, ears flat. Mirrors the
    /// `alertness` axis in `NightFoxArt`; keep the two in step.
    private var alertness: Double {
        switch mood {
        case .glowing, .ready:      return 1.0
        case .waiting:              return 0.95
        case .streaklit:            return 0.85
        case .nesting:              return 0.55
        case .resting:              return 0.42
        case .sleeping:             return 0.1
        }
    }

    private var tint: Color {
        switch mood {
        case .glowing:              return softGreen
        case .ready:                return amber
        case .waiting, .streaklit:  return lavender
        case .nesting, .resting:    return mutedLavender
        case .sleeping:             return mutedLavender
        }
    }

    private var furOpacity: Double {
        switch mood {
        case .glowing:              return 0.95
        case .ready:                return 0.9
        case .waiting, .streaklit:  return 0.8
        case .nesting:              return 0.6
        case .resting:              return 0.45
        case .sleeping:             return 0.3
        }
    }

    private var haloOpacity: Double {
        switch mood {
        case .glowing:              return 0.5
        case .ready:                return 0.45
        case .waiting, .streaklit:  return 0.3
        case .nesting:              return 0.18
        case .resting:              return 0.14
        case .sleeping:             return 0.08
        }
    }

    /// Ears fold outward and the head sinks as the fox settles — one axis, so a
    /// mood can never end up half-asleep by accident.
    private var earAngle: Double { 16 + 40 * (1 - alertness) }
    private var headDrop: CGFloat { size * 0.1 * CGFloat(1 - alertness) }

    private func ear(flipped: Bool) -> some View {
        LunaraEar()
            .fill(tint)
            .opacity(furOpacity * 0.9)
            .frame(width: size * 0.3, height: size * 0.36)
            .rotationEffect(.degrees(flipped ? earAngle : -earAngle), anchor: .bottom)
            .offset(x: flipped ? size * 0.19 : -size * 0.19, y: -size * 0.24 + headDrop)
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(tint)
                .opacity(haloOpacity)
                .frame(width: size * 1.4, height: size * 1.4)
                .blur(radius: size * 0.3)

            // Ears sit behind the head so the silhouette stays clean.
            ear(flipped: false)
            ear(flipped: true)

            Ellipse()
                .fill(tint)
                .opacity(furOpacity)
                .frame(width: size * 0.68, height: size * 0.6)
                .offset(y: size * 0.04 + headDrop)

            // The pale muzzle — the one mark that stops the head reading as a dot.
            Ellipse()
                .fill(Color.white)
                .opacity(furOpacity * 0.45)
                .frame(width: size * 0.3, height: size * 0.2)
                .offset(y: size * 0.16 + headDrop)

            if mood == .waiting {
                Circle()
                    .fill(amber)
                    .frame(width: size * 0.15, height: size * 0.15)
                    .offset(x: size * 0.38, y: -size * 0.3)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct LunaraStreakProvider: TimelineProvider {
    func placeholder(in context: Context) -> LunaraStreakEntry {
        LunaraStreakEntry(date: Date(), streak: 7, status: .open, atRisk: true, streakProtected: false, companion: .streaklit)
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

        // `status` is the current contract; the older builds only wrote the two
        // booleans, so fall back to them rather than showing a blank widget to
        // anyone whose app hasn't updated yet.
        let status: LunaraStatus
        if let raw = defaults?.string(forKey: "status") {
            status = LunaraStatus.from(raw)
        } else if defaults?.bool(forKey: "isPaired") == false {
            status = .unpaired
        } else {
            status = defaults?.bool(forKey: "ritualComplete") == true ? .complete : .open
        }

        return LunaraStreakEntry(
            date: Date(),
            streak: defaults?.integer(forKey: "streak") ?? 0,
            status: status,
            atRisk: defaults?.bool(forKey: "atRisk") ?? false,
            streakProtected: defaults?.bool(forKey: "streakProtected") ?? false,
            // Absent on any build older than the companion — `.from` falls back
            // to `.nesting`, the one mood that says nothing it might get wrong.
            companion: LunaraCompanion.from(defaults?.string(forKey: "companion"))
        )
    }
}

struct LunaraStreakWidgetView: View {
    var entry: LunaraStreakProvider.Entry

    private var moonSymbol: String {
        entry.streak >= 14 ? "moon.stars.fill" : "moon.stars"
    }

    /// The one line that decides whether the widget is worth glancing at.
    /// Status first, streak second — "Ready to reveal" beats any number.
    private var statusText: String {
        switch entry.status {
        case .unpaired: return "Open Lunara to connect"
        case .ready:    return "Ready to reveal 🌙"
        case .waiting:  return "Waiting for your partner…"
        case .complete: return "Tonight is complete 🌙"
        case .open:     return entry.atRisk ? "Tonight is still open" : "Tonight's ritual is waiting"
        }
    }

    private var statusColor: Color {
        switch entry.status {
        case .ready:    return amber
        case .complete: return softGreen
        case .waiting:  return lavender
        case .open:     return entry.atRisk ? amber : mutedLavender
        case .unpaired: return mutedLavender
        }
    }

    private var streakCaption: String {
        if entry.streakProtected { return "nights held together" }
        return entry.streak == 1 ? "night together" : "nights together"
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [backgroundTop, backgroundBottom], startPoint: .top, endPoint: .bottom)

            if entry.status == .unpaired {
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
                            .foregroundStyle(entry.status == .ready ? amber : lavender)
                        Text("LUNARA")
                            .font(.system(size: 11, weight: .semibold))
                            .tracking(1.4)
                            .foregroundStyle(lavender)
                        Spacer(minLength: 4)
                        CompanionMark(mood: entry.companion, size: 20)
                    }

                    Spacer(minLength: 4)

                    // A couple with no streak yet gets an invitation instead of a
                    // zero — "0 nights together" is the least inviting number there is.
                    if entry.streak > 0 {
                        Text("\(entry.streak)")
                            .font(.system(size: 38, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)

                        Text(streakCaption)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(mutedLavender)
                    } else {
                        Text("Tonight")
                            .font(.system(size: 26, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white)

                        Text("where it starts")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(mutedLavender)
                    }

                    Spacer(minLength: 4)

                    Text(statusText)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(statusColor)
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
                // Deep-links straight into tonight rather than the last screen
                // the app happened to be on.
                //
                // Answered by `app/tonight.tsx`, which redirects to the Tonight
                // tab. Keep this in step with TONIGHT_PATH in
                // `lib/inviteLinks.ts` — nothing here can fail at compile time,
                // and for a long time this URL had no route at all, so every
                // tap on the widget opened the app onto the not-found screen.
                .widgetURL(URL(string: "lunara://tonight"))
        }
        .configurationDisplayName("Lunara")
        .description("Tonight's ritual, your streak, and when your partner is waiting.")
        .supportedFamilies([.systemSmall])
    }
}

#Preview(as: .systemSmall) {
    LunaraStreakWidget()
} timeline: {
    LunaraStreakEntry(date: .now, streak: 12, status: .ready, atRisk: false, streakProtected: false, companion: .ready)
    LunaraStreakEntry(date: .now, streak: 12, status: .waiting, atRisk: true, streakProtected: false, companion: .waiting)
    LunaraStreakEntry(date: .now, streak: 41, status: .complete, atRisk: false, streakProtected: true, companion: .glowing)
    LunaraStreakEntry(date: .now, streak: 0, status: .open, atRisk: false, streakProtected: false, companion: .sleeping)
    LunaraStreakEntry(date: .now, streak: 0, status: .unpaired, atRisk: false, streakProtected: false, companion: .nesting)
}
