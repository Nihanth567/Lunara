import WidgetKit
import SwiftUI

// Mirrors APP_GROUP in expo-target.config.js — keep in sync.
private let appGroup = "group.com.lunara.app.widget"

// Mirrors constants/colors.ts — keep in sync. The widget sits on the home
// screen next to the app icon, so a palette that has drifted from the app's is
// visible in a way an in-app inconsistency never is.
// Mirrors `constants/colors.ts`. These are hand-transcribed because a Swift
// extension cannot import the TS token file — so when the palette moves, this
// block moves with it, and the hex in each comment is what to diff against.
private let backgroundTop = Color(red: 0.055, green: 0.043, blue: 0.078)     // ink[0]      #0E0B14
private let backgroundBottom = Color(red: 0.165, green: 0.110, blue: 0.173)  // warm floor  #2A1C2C
private let textPrimary = Color(red: 0.969, green: 0.945, blue: 0.910)       // content[0]  #F7F1E8
private let textMuted = Color(red: 0.604, green: 0.565, blue: 0.518)         // content[2]  #9A9084
private let mint = Color(red: 0.490, green: 0.871, blue: 0.710)              // success     #7DDEB5
private let peach = Color(red: 1.000, green: 0.722, blue: 0.420)             // glow        #FFB86B
private let heart = Color(red: 1.000, green: 0.478, blue: 0.604)             // heart       #FF7A9A
private let gold = Color(red: 0.941, green: 0.780, blue: 0.369)              // streak      #F0C75E

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
        case .glowing:              return mint
        case .ready:                return peach
        case .waiting, .streaklit:  return textPrimary
        case .nesting, .resting:    return textMuted
        case .sleeping:             return textMuted
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
                    .fill(peach)
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
        case .unpaired: return "Invite your person"
        case .ready:    return "Both of you showed up"
        case .waiting:  return "Holding a light for them"
        case .complete: return "Tonight is shared"
        case .open:     return "Tonight's still open"
        }
    }

    private var statusColor: Color {
        switch entry.status {
        case .ready:    return heart
        case .complete: return mint
        case .waiting:  return peach
        case .open:     return entry.atRisk ? peach : textMuted
        case .unpaired: return heart
        }
    }

    private var streakCaption: String {
        if entry.streakProtected { return "nights held together" }
        return entry.streak == 1 ? "day together" : "days together"
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [backgroundTop, backgroundBottom], startPoint: .top, endPoint: .bottom)

            if entry.status == .unpaired {
                VStack(spacing: 8) {
                    Image(systemName: "moon.stars")
                        .font(.system(size: 20))
                        .foregroundStyle(textPrimary)
                    Text("Your fox is waiting for the other half")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(textMuted)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                }
                .padding(16)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Image(systemName: moonSymbol)
                            .font(.system(size: 15))
                            .foregroundStyle(entry.status == .ready ? peach : textPrimary)
                        Text("LUNARA")
                            .font(.system(size: 11, weight: .semibold))
                            .tracking(1.4)
                            .foregroundStyle(textPrimary)
                        Spacer(minLength: 4)
                        CompanionMark(mood: entry.companion, size: 30)
                    }

                    Spacer(minLength: 4)

                    // A couple with no streak yet gets an invitation instead of a
                    // zero — "0 nights together" is the least inviting number there is.
                    if entry.streak > 0 {
                        // Gold, matching the streak chip in the app. `.white` was
                        // the one pure white left anywhere in the product.
                        Text("\(entry.streak)")
                            .font(.system(size: 38, weight: .bold, design: .rounded))
                            .foregroundStyle(gold)

                        Text(streakCaption)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(textMuted)
                    } else {
                        Text("Tonight")
                            .font(.system(size: 26, weight: .semibold, design: .rounded))
                            .foregroundStyle(textPrimary)

                        Text("where it starts")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(textMuted)
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
