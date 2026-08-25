import { useMemo, useState } from "react";

type Mood = "all" | "grateful" | "cute" | "grow";
type Entry = {
  date: string;
  day: string;
  label: string;
  color: string;
  you: string;
  them?: string;
  mood: Exclude<Mood, "all">;
};

const entries: Entry[] = [
  { date: "Saturday, June 15", day: "15", label: "Grateful", color: "#f4a58d", you: "You made coffee before I even asked.", them: "Your laugh made the whole kitchen warmer.", mood: "grateful" },
  { date: "Friday, June 14", day: "14", label: "Cute", color: "#d4b7ec", you: "The tiny dance you did while looking for your keys.", them: "I still have the photo of your sleepy face.", mood: "cute" },
  { date: "Thursday, June 13", day: "13", label: "Grow", color: "#a8d6c0", you: "A slower Sunday, with nowhere we need to be.", them: "Let's keep choosing the unhurried version.", mood: "grow" },
  { date: "Wednesday, June 12", day: "12", label: "Grateful", color: "#f4a58d", you: "You always make room for the hard conversations.", mood: "grateful" },
];

const tabs: { key: Mood; label: string }[] = [
  { key: "all", label: "All notes" },
  { key: "grateful", label: "Grateful" },
  { key: "cute", label: "Cute" },
  { key: "grow", label: "Grow" },
];

function MiniMark({ color }: { color: string }) {
  return <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block", boxShadow: `0 0 0 4px ${color}18` }} />;
}

export function LunaraMomentsLedger() {
  const [mood, setMood] = useState<Mood>("all");
  const [open, setOpen] = useState<number | null>(0);
  const [showComposer, setShowComposer] = useState(false);
  const visible = useMemo(() => entries.filter((entry) => mood === "all" || entry.mood === mood), [mood]);

  const setTab = (next: Mood) => {
    setMood(next);
    setOpen(0);
  };

  return (
    <main style={{ minHeight: "100dvh", background: "#f4efe8", color: "#2d2536", fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif", padding: "28px 18px 42px" }}>
      <div style={{ maxWidth: 670, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 30 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: "#9b6b68", marginBottom: 13 }}>The two of you · 12 nights</div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(38px, 8vw, 62px)", lineHeight: .94, letterSpacing: "-.055em", fontWeight: 400, margin: 0 }}>A little<br /><em style={{ color: "#b47568" }}>ledger</em> of us.</h1>
            <p style={{ color: "#8b7c82", fontSize: 13, lineHeight: 1.5, margin: "18px 0 0", maxWidth: 280 }}>Small observations, kept somewhere softer than a camera roll.</p>
          </div>
          <button type="button" onClick={() => setShowComposer(true)} style={{ flexShrink: 0, border: 0, background: "#332943", color: "#f7f0e9", borderRadius: 999, padding: "12px 15px", fontSize: 12, cursor: "pointer", boxShadow: "0 7px 18px #33294322" }}>＋ Add note</button>
        </header>

        <nav aria-label="Filter notes" style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 28, paddingBottom: 3 }}>
          {tabs.map((tab) => (
            <button type="button" key={tab.key} onClick={() => setTab(tab.key)} style={{ whiteSpace: "nowrap", border: mood === tab.key ? "1px solid #a96f68" : "1px solid #ddcfc9", color: mood === tab.key ? "#8e5a58" : "#9a8a8b", background: mood === tab.key ? "#fffaf5" : "transparent", borderRadius: 999, padding: "9px 14px", fontSize: 12, cursor: "pointer" }}>{tab.label}</button>
          ))}
        </nav>

        <section aria-label="Shared moments" style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 19, top: 24, bottom: 24, width: 1, background: "#d9c9c2" }} />
          {visible.map((entry, index) => {
            const isOpen = open === index;
            return (
              <article key={entry.date} style={{ position: "relative", paddingLeft: 46, marginBottom: 12 }}>
                <div style={{ position: "absolute", left: 15, top: 25, zIndex: 1 }}><MiniMark color={entry.color} /></div>
                <button type="button" onClick={() => setOpen(isOpen ? null : index)} aria-expanded={isOpen} style={{ width: "100%", textAlign: "left", border: "1px solid #e1d5ce", borderRadius: 16, background: isOpen ? "#fffaf5" : "#f9f4ee", padding: "17px 18px", cursor: "pointer", color: "#2d2536", boxShadow: isOpen ? "0 10px 25px #6d4e4a0d" : "none", transition: "transform .2s ease, box-shadow .2s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 11, color: "#9b8988", letterSpacing: ".08em", textTransform: "uppercase" }}><span>{entry.date}</span><span style={{ color: entry.color }}>·</span><span style={{ color: entry.color }}>{entry.label}</span></div>
                    <span style={{ color: "#ae9995", fontSize: 16, lineHeight: 1, transform: isOpen ? "rotate(45deg)" : "none", transition: "transform .2s ease" }}>＋</span>
                  </div>
                  <p style={{ fontFamily: "Georgia, serif", fontSize: "clamp(20px, 4vw, 27px)", lineHeight: 1.16, margin: "17px 0 0", letterSpacing: "-.025em" }}>“{entry.you}”</p>
                  {isOpen && entry.them && (
                    <div style={{ borderTop: "1px solid #eadfd8", marginTop: 18, paddingTop: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ width: 23, height: 23, borderRadius: "50%", background: "#332943", color: "#f7f0e9", display: "grid", placeItems: "center", fontSize: 10, flexShrink: 0 }}>T</span>
                      <p style={{ fontFamily: "Georgia, serif", fontSize: 17, lineHeight: 1.3, margin: 0, color: "#66566b" }}>“{entry.them}”</p>
                    </div>
                  )}
                  {isOpen && !entry.them && <div style={{ color: "#aa9893", fontSize: 12, marginTop: 16 }}>Waiting for their side of this note.</div>}
                </button>
              </article>
            );
          })}
          {visible.length === 0 && <div style={{ marginLeft: 46, border: "1px dashed #cdbdb5", borderRadius: 16, padding: 32, textAlign: "center", color: "#927f83", fontSize: 13 }}>Nothing in this chapter yet.<br /><button type="button" onClick={() => setShowComposer(true)} style={{ marginTop: 13, border: 0, background: "none", color: "#a3625f", cursor: "pointer", fontSize: 13 }}>Write the first note →</button></div>}
        </section>

        <footer style={{ display: "flex", justifyContent: "space-between", gap: 14, marginTop: 30, padding: "17px 4px 0", borderTop: "1px solid #dfd2ca", color: "#a08f90", fontSize: 11 }}>
          <span>Last tended tonight · 9:42 PM</span>
          <button type="button" onClick={() => window.alert("Your shared notes are tucked away safely.")} style={{ border: 0, background: "none", color: "#a3625f", cursor: "pointer", fontSize: 11 }}>12 notes kept ↗</button>
        </footer>
      </div>

      {showComposer && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "#33294355", display: "grid", placeItems: "center", padding: 18, zIndex: 5 }}>
          <div style={{ width: "min(100%, 390px)", background: "#fffaf5", borderRadius: 20, padding: 24, boxShadow: "0 20px 60px #33294335" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 27, margin: 0 }}>Keep tonight's small thing</h2><button type="button" onClick={() => setShowComposer(false)} aria-label="Close" style={{ border: 0, background: "none", color: "#8f7a80", fontSize: 22, cursor: "pointer" }}>×</button></div>
            <textarea autoFocus placeholder="What do you want to remember?" style={{ width: "100%", minHeight: 125, boxSizing: "border-box", resize: "vertical", marginTop: 20, border: "1px solid #dfd1c8", borderRadius: 12, background: "#f8f1ea", padding: 14, font: "16px Georgia, serif", color: "#332943", outlineColor: "#b47568" }} />
            <button type="button" onClick={() => { setShowComposer(false); window.alert("Your note is ready for tonight's ritual."); }} style={{ width: "100%", marginTop: 14, border: 0, borderRadius: 999, background: "#b47568", color: "#fff8f1", padding: 13, cursor: "pointer", fontSize: 13 }}>Keep this moment</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default LunaraMomentsLedger;