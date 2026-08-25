import { useMemo, useRef, useState } from "react";

type MomentKind = "Grateful" | "Cute" | "Grow";
type Moment = {
  date: string;
  weekday: string;
  day: string;
  month: string;
  kind: MomentKind;
  note: string;
  reply?: string;
  phase: number;
  accent: string;
};

const moments: Moment[] = [
  { date: "2024-06-15", weekday: "SATURDAY", day: "15", month: "JUN", kind: "Grateful", note: "You made coffee before I even asked.", reply: "Your laugh made the whole kitchen warmer.", phase: 0.18, accent: "#ff9d87" },
  { date: "2024-06-14", weekday: "FRIDAY", day: "14", month: "JUN", kind: "Cute", note: "The tiny dance you did while looking for your keys.", reply: "I still have the photo of your sleepy face.", phase: 0.36, accent: "#d4b8ef" },
  { date: "2024-06-13", weekday: "THURSDAY", day: "13", month: "JUN", kind: "Grow", note: "A slower Sunday, with nowhere we need to be.", reply: "Let's keep choosing the unhurried version.", phase: 0.56, accent: "#a9d5b4" },
  { date: "2024-06-12", weekday: "WEDNESDAY", day: "12", month: "JUN", kind: "Grateful", note: "You always make room for the hard conversations.", phase: 0.74, accent: "#ff9d87" },
  { date: "2024-06-11", weekday: "TUESDAY", day: "11", month: "JUN", kind: "Cute", note: "The way you say my name when you are half asleep.", reply: "Still my favorite sound in the morning.", phase: 0.88, accent: "#d4b8ef" },
  { date: "2024-06-10", weekday: "MONDAY", day: "10", month: "JUN", kind: "Grow", note: "We left the phones in the other room for dinner.", phase: 0.98, accent: "#a9d5b4" },
];

const filters = ["All", "Grateful", "Cute", "Grow"] as const;

function Moon({ phase, size = 42, accent = "#f6f0ff" }: { phase: number; size?: number; accent?: string }) {
  const x = phase < 0.5 ? 100 - phase * 200 : (phase - 0.5) * 200;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        position: "relative",
        overflow: "hidden",
        background: "#f6f0ff",
        boxShadow: `0 0 ${size * 0.45}px ${accent}35`,
      }}
    >
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#21183d", transform: `translateX(${x - 100}%)`, transition: "transform .35s ease" }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `linear-gradient(90deg, transparent 48%, ${accent}55 50%, transparent 52%)`, opacity: 0.7 }} />
    </span>
  );
}

function Star({ top, left, size = 2 }: { top: string; left: string; size?: number }) {
  return <i aria-hidden="true" style={{ position: "absolute", top, left, width: size, height: size, background: "#f8f1ff", borderRadius: "50%", opacity: 0.45, boxShadow: "0 0 9px #efe1ff" }} />;
}

export function LunaraMomentsMoonTimeline() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [selectedDate, setSelectedDate] = useState(moments[0].date);
  const [showReply, setShowReply] = useState(false);
  const datesRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(() => moments.filter((moment) => filter === "All" || moment.kind === filter), [filter]);
  const activeIndex = Math.max(0, visible.findIndex((moment) => moment.date === selectedDate));
  const active = visible[activeIndex] ?? visible[0];

  function chooseFilter(next: (typeof filters)[number]) {
    setFilter(next);
    setShowReply(false);
    const nextMoment = moments.find((moment) => next === "All" || moment.kind === next);
    if (nextMoment) setSelectedDate(nextMoment.date);
  }

  function move(step: number) {
    if (!visible.length) return;
    const next = (activeIndex + step + visible.length) % visible.length;
    setSelectedDate(visible[next].date);
    setShowReply(false);
    datesRef.current?.children[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  return (
    <main className="moon-timeline" style={{ minHeight: "100dvh", background: "radial-gradient(ellipse at 70% 4%, #332553 0%, #18142f 37%, #0f0c22 82%)", color: "#f8f1ff", fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden" }}>
      <Star top="12%" left="8%" size={3} /><Star top="18%" left="83%" /><Star top="44%" left="92%" size={3} /><Star top="70%" left="14%" /><Star top="83%" left="78%" size={2} />
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "34px 28px 48px", position: "relative" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 42 }}>
          <div>
            <div style={{ color: "#ff9d87", fontSize: 11, letterSpacing: ".22em", fontWeight: 700 }}>LUNARA / MOMENTS</div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(36px, 5vw, 58px)", lineHeight: .98, letterSpacing: "-.045em", fontWeight: 400, margin: "18px 0 12px" }}>Our little<br /><em style={{ color: "#d4b8ef", fontStyle: "italic" }}>orbit.</em></h1>
            <p style={{ color: "#a69abf", margin: 0, fontSize: 14 }}>A record of the ordinary things that become everything.</p>
          </div>
          <button type="button" onClick={() => window.alert("Your new moment is ready to write.")} style={{ marginTop: 5, border: "1px solid #806aa7", background: "rgba(35,25,66,.55)", color: "#f8f1ff", borderRadius: 999, padding: "11px 16px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>＋ Add moment</button>
        </header>

        <nav aria-label="Moment filters" style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 29, flexWrap: "wrap" }}>
          <span style={{ color: "#766890", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", marginRight: 6 }}>Show</span>
          {filters.map((item) => (
            <button key={item} type="button" onClick={() => chooseFilter(item)} style={{ color: filter === item ? "#19122f" : "#c8b9dd", background: filter === item ? "#ff9d87" : "transparent", border: `1px solid ${filter === item ? "#ff9d87" : "#4c3c6c"}`, borderRadius: 999, padding: "8px 14px", fontSize: 12, cursor: "pointer", transition: "all .2s ease" }}>{item}</button>
          ))}
          <span style={{ marginLeft: "auto", color: "#75698d", fontSize: 12 }}>{visible.length} {visible.length === 1 ? "entry" : "entries"}</span>
        </nav>

        <section aria-label="Swipeable date timeline" style={{ borderTop: "1px solid rgba(208,187,239,.2)", borderBottom: "1px solid rgba(208,187,239,.2)", padding: "18px 0 17px", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <button type="button" aria-label="Previous date" onClick={() => move(-1)} style={{ flex: "0 0 32px", height: 32, border: "1px solid #55476d", borderRadius: "50%", color: "#c7b6dc", background: "transparent", cursor: "pointer", fontSize: 17 }}>‹</button>
            <div ref={datesRef} className="date-scroller" style={{ display: "flex", overflowX: "auto", gap: 12, scrollSnapType: "x mandatory", scrollbarWidth: "none", flex: 1, padding: "2px 4px" }}>
              {visible.map((moment) => {
                const isActive = active?.date === moment.date;
                return <button key={moment.date} type="button" onClick={() => { setSelectedDate(moment.date); setShowReply(false); }} style={{ scrollSnapAlign: "center", minWidth: 112, display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer", border: `1px solid ${isActive ? moment.accent : "transparent"}`, background: isActive ? "rgba(57,40,87,.9)" : "transparent", borderRadius: 12, padding: "10px 12px", color: isActive ? "#fbf4ff" : "#887aa3" }}>
                  <Moon phase={moment.phase} size={25} accent={moment.accent} />
                  <span><b style={{ display: "block", fontSize: 15, fontWeight: 500 }}>{moment.day}</b><small style={{ fontSize: 9, letterSpacing: ".14em" }}>{moment.month}</small></span>
                </button>;
              })}
            </div>
            <button type="button" aria-label="Next date" onClick={() => move(1)} style={{ flex: "0 0 32px", height: 32, border: "1px solid #55476d", borderRadius: "50%", color: "#c7b6dc", background: "transparent", cursor: "pointer", fontSize: 17 }}>›</button>
          </div>
          <div style={{ textAlign: "center", color: "#70638c", fontSize: 10, letterSpacing: ".18em", marginTop: 15, textTransform: "uppercase" }}>Swipe to travel through your nights</div>
        </section>

        {active ? <article style={{ display: "grid", gridTemplateColumns: "minmax(180px, .62fr) minmax(0, 1.38fr)", minHeight: 390, border: `1px solid ${active.accent}55`, borderRadius: 22, overflow: "hidden", background: "rgba(29,22,55,.72)", boxShadow: "0 20px 65px rgba(5,2,20,.25)" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "34px 30px", background: "linear-gradient(150deg, rgba(70,49,103,.8), rgba(29,22,55,.2))", borderRight: "1px solid rgba(222,205,247,.1)" }}>
            <div><Moon phase={active.phase} size={91} accent={active.accent} /><div style={{ color: active.accent, fontSize: 11, letterSpacing: ".17em", marginTop: 22 }}>{active.kind.toUpperCase()}</div></div>
            <div><div style={{ fontFamily: "Georgia, serif", fontSize: 31 }}>{active.day} <span style={{ fontSize: 18, color: "#a69abf" }}>{active.month}</span></div><div style={{ color: "#837595", fontSize: 11, letterSpacing: ".13em", marginTop: 7 }}>{active.weekday}</div></div>
          </div>
          <div style={{ padding: "clamp(28px, 5vw, 54px)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div><div style={{ color: "#806f9e", fontSize: 11, letterSpacing: ".13em", textTransform: "uppercase" }}>A note under this moon</div><div style={{ height: 1, width: 54, background: active.accent, margin: "25px 0 28px" }} /><blockquote style={{ fontFamily: "Georgia, serif", fontSize: "clamp(28px, 4vw, 45px)", lineHeight: 1.14, letterSpacing: "-.035em", margin: 0 }}>“{showReply && active.reply ? active.reply : active.note}”</blockquote></div>
            <div style={{ borderTop: "1px solid rgba(230,220,247,.12)", paddingTop: 18, marginTop: 35, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><span style={{ color: "#88799f", fontSize: 12 }}>{showReply ? "From your partner" : "From you"}</span>{active.reply && <button type="button" onClick={() => setShowReply((value) => !value)} style={{ border: 0, background: "none", color: active.accent, cursor: "pointer", fontSize: 12 }}>{showReply ? "Read yours" : "Read theirs"} <span style={{ marginLeft: 7 }}>→</span></button>}</div>
          </div>
        </article> : <div style={{ minHeight: 390, display: "grid", placeItems: "center", color: "#9a8db2" }}>No moments in this orbit yet.</div>}

        <footer style={{ display: "flex", justifyContent: "space-between", marginTop: 28, color: "#716487", fontSize: 12, gap: 14, flexWrap: "wrap" }}><span>June 10 — June 15, 2024</span><span style={{ color: "#a99bbd" }}>Keep noticing each other.</span></footer>
      </div>
      <style>{`
        .moon-timeline button:focus-visible { outline: 2px solid #ff9d87; outline-offset: 3px; }
        .date-scroller::-webkit-scrollbar { display: none; }
        @media (max-width: 620px) {
          .moon-timeline > div { padding: 28px 17px 38px !important; }
          .moon-timeline article { grid-template-columns: 1fr !important; }
          .moon-timeline article > div:first-child { min-height: 205px; flex-direction: row !important; align-items: flex-end; border-right: 0 !important; border-bottom: 1px solid rgba(222,205,247,.1); padding: 24px !important; }
          .moon-timeline article > div:last-child { min-height: 335px; }
          .moon-timeline header { margin-bottom: 32px !important; }
          .moon-timeline header button { padding: 9px 11px !important; }
        }
      `}</style>
    </main>
  );
}

export default LunaraMomentsMoonTimeline;