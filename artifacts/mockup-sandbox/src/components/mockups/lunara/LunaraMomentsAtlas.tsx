import { useMemo, useState } from "react";

type Filter = "all" | "grateful" | "cute" | "grow";
type Moment = {
  date: number;
  weekday: string;
  type: Exclude<Filter, "all">;
  title: string;
  yours: string;
  theirs?: string;
  color: string;
};

const moments: Moment[] = [
  { date: 15, weekday: "SAT", type: "grateful", title: "The small kindnesses", yours: "You made coffee before I even asked.", theirs: "Your laugh made the whole kitchen warmer.", color: "#ff9a8b" },
  { date: 14, weekday: "FRI", type: "cute", title: "A tiny dance", yours: "The tiny dance you did while looking for your keys.", theirs: "I still have the photo of your sleepy face.", color: "#c3b1e1" },
  { date: 13, weekday: "THU", type: "grow", title: "The unhurried version", yours: "A slower Sunday, with nowhere we need to be.", theirs: "Let's keep choosing the unhurried version.", color: "#a8d8a8" },
  { date: 12, weekday: "WED", type: "grateful", title: "Room for hard things", yours: "You always make room for the hard conversations.", color: "#ff9a8b" },
  { date: 10, weekday: "MON", type: "cute", title: "A familiar song", yours: "You put on the song we played on our first road trip.", theirs: "I knew you would remember it.", color: "#c3b1e1" },
];

const filters: { key: Filter; label: string; tint: string }[] = [
  { key: "all", label: "All nights", tint: "#f8f5ff" },
  { key: "grateful", label: "Grateful", tint: "#ff9a8b" },
  { key: "cute", label: "Cute", tint: "#c3b1e1" },
  { key: "grow", label: "Grow", tint: "#a8d8a8" },
];

export function LunaraMomentsAtlas() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedDate, setSelectedDate] = useState(15);
  const [partnerView, setPartnerView] = useState(false);
  const [saved, setSaved] = useState(false);
  const [month, setMonth] = useState("JUNE 2024");

  const visible = useMemo(() => moments.filter((item) => filter === "all" || item.type === filter), [filter]);
  const active = visible.find((item) => item.date === selectedDate) ?? visible[0];
  const dates = Array.from({ length: 30 }, (_, i) => i + 1);

  function chooseFilter(next: Filter) {
    setFilter(next);
    const first = moments.find((item) => next === "all" || item.type === next);
    if (first) setSelectedDate(first.date);
    setPartnerView(false);
  }

  return (
    <main style={{ minHeight: "100dvh", background: "#0f0c29", color: "#f8f5ff", fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px 42px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 30 }}>
          <div>
            <div style={{ color: "#ff9a8b", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", marginBottom: 13 }}>THE NIGHTBOOK</div>
            <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: "clamp(36px, 6vw, 64px)", lineHeight: .96, fontWeight: 400, letterSpacing: "-.045em" }}>Keep the good<br />close.</h1>
            <p style={{ color: "#9b89c2", fontSize: 14, lineHeight: 1.5, maxWidth: 350, margin: "16px 0 0" }}>A quiet index of the moments you chose to notice together.</p>
          </div>
          <button type="button" onClick={() => setSaved((value) => !value)} aria-label="Save nightbook" style={{ border: `1px solid ${saved ? "#ff9a8b" : "rgba(255,255,255,.14)"}`, background: saved ? "rgba(255,154,139,.12)" : "rgba(255,255,255,.04)", color: saved ? "#ff9a8b" : "#c3b1e1", borderRadius: 999, padding: "10px 14px", cursor: "pointer", fontSize: 12 }}>
            {saved ? "Saved" : "Save this view"} <span style={{ marginLeft: 6 }}>{saved ? "✦" : "♡"}</span>
          </button>
        </header>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button type="button" onClick={() => setMonth(month === "JUNE 2024" ? "MAY 2024" : "JUNE 2024")} style={{ background: "none", border: 0, color: "#f8f5ff", cursor: "pointer", padding: 0, fontSize: 12, letterSpacing: ".14em" }}>‹ &nbsp;{month}&nbsp; ›</button>
          <span style={{ fontSize: 11, color: "#7a6d98" }}>12 nights together</span>
        </div>

        <section style={{ borderTop: "1px solid rgba(195,177,225,.2)", borderBottom: "1px solid rgba(195,177,225,.2)", padding: "18px 0 14px", marginBottom: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(15, minmax(22px, 1fr))", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
            {dates.map((date) => {
              const item = moments.find((entry) => entry.date === date);
              const isSelected = active?.date === date;
              return <button type="button" key={date} aria-label={`Open June ${date}`} onClick={() => item && setSelectedDate(date)} style={{ minWidth: 28, border: 0, background: "none", color: isSelected ? "#f8f5ff" : "#6f638d", cursor: item ? "pointer" : "default", padding: "2px 0", opacity: item ? 1 : .65 }}>
                <span style={{ display: "block", fontSize: 9, marginBottom: 8 }}>{date === 15 ? "SAT" : date === 14 ? "FRI" : date === 13 ? "THU" : date === 12 ? "WED" : ""}</span>
                <span style={{ display: "block", height: 6, width: 6, borderRadius: "50%", margin: "0 auto", background: item?.color ?? "rgba(195,177,225,.2)", boxShadow: isSelected ? `0 0 0 4px ${item?.color}26, 0 0 14px ${item?.color}` : "none", opacity: item ? 1 : .5 }} />
              </button>;
            })}
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {filters.map((item) => <button type="button" key={item.key} onClick={() => chooseFilter(item.key)} style={{ whiteSpace: "nowrap", border: filter === item.key ? `1px solid ${item.tint}` : "1px solid rgba(255,255,255,.1)", background: filter === item.key ? `${item.tint}18` : "rgba(255,255,255,.03)", color: filter === item.key ? item.tint : "#9b89c2", borderRadius: 999, padding: "9px 14px", fontSize: 11, cursor: "pointer" }}>{item.label}</button>)}
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(230px, .9fr)", gap: 22 }}>
          {active ? <article style={{ minHeight: 360, borderRadius: 18, border: `1px solid ${active.color}54`, background: "linear-gradient(140deg, rgba(39,31,70,.95), rgba(24,19,47,.82))", padding: "clamp(24px, 5vw, 44px)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: 28, top: 22, color: active.color, fontSize: 27, opacity: .8 }}>{partnerView ? "◑" : "◒"}</div>
            <div style={{ color: active.color, fontSize: 11, letterSpacing: ".17em", textTransform: "uppercase" }}>{active.type} · JUNE {active.date}</div>
            <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "clamp(28px, 4vw, 43px)", lineHeight: 1.05, letterSpacing: "-.03em", margin: "28px 0 16px", maxWidth: 470 }}>{active.title}</h2>
            <div style={{ height: 1, width: 45, background: active.color, opacity: .7, marginBottom: 23 }} />
            <p style={{ fontFamily: "Georgia, serif", fontSize: "clamp(20px, 3vw, 29px)", lineHeight: 1.28, margin: 0, maxWidth: 560 }}>“{partnerView && active.theirs ? active.theirs : active.yours}”</p>
            <div style={{ position: "absolute", bottom: 24, left: "clamp(24px, 5vw, 44px)", right: "clamp(24px, 5vw, 44px)", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span style={{ color: "#9b89c2", fontSize: 11 }}>{partnerView ? "Your partner noticed" : "You noticed"}</span>
              {active.theirs && <button type="button" onClick={() => setPartnerView((value) => !value)} style={{ border: 0, background: "none", color: active.color, cursor: "pointer", fontSize: 11 }}>{partnerView ? "Read your note" : "See their note"} →</button>}
            </div>
          </article> : <div style={{ minHeight: 360, border: "1px dashed rgba(195,177,225,.25)", borderRadius: 18, display: "grid", placeItems: "center", color: "#9b89c2", fontSize: 13 }}>No notes in this orbit yet.</div>}

          <aside>
            <div style={{ color: "#7a6d98", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", margin: "4px 0 14px" }}>The index · {visible.length} found</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {visible.map((item) => <button type="button" key={item.date} onClick={() => { setSelectedDate(item.date); setPartnerView(false); }} style={{ display: "grid", gridTemplateColumns: "40px 1fr 18px", alignItems: "center", gap: 12, textAlign: "left", border: 0, borderRadius: 10, padding: "12px 10px", cursor: "pointer", background: active?.date === item.date ? "rgba(255,255,255,.08)" : "transparent", color: active?.date === item.date ? "#f8f5ff" : "#9b89c2" }}>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 22, color: item.color }}>{item.date}</span><span><span style={{ display: "block", fontSize: 12 }}>{item.title}</span><span style={{ display: "block", fontSize: 10, color: "#6f638d", marginTop: 3 }}>{item.weekday} · {item.type}</span></span><span style={{ color: item.color, fontSize: 13 }}>›</span>
              </button>)}
            </div>
            <div style={{ marginTop: 28, padding: "17px 0 0", borderTop: "1px solid rgba(255,255,255,.08)", color: "#7a6d98", fontSize: 12, lineHeight: 1.55 }}>The archive is not a score. It is proof that you were here, paying attention.</div>
          </aside>
        </section>
        <footer style={{ marginTop: 30, paddingTop: 17, borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, color: "#7a6d98", fontSize: 11 }}>
          <span>Tonight is still unwritten.</span><button type="button" onClick={() => window.alert("Tonight's ritual is ready when you are.")} style={{ color: "#ff9a8b", background: "none", border: 0, cursor: "pointer", fontSize: 11 }}>Write tonight +</button>
        </footer>
      </div>
      <style>{`@media (max-width: 700px) { main > div { padding: 24px 17px 34px !important; } section[style*="grid-template-columns: minmax(0, 1.1fr)"] { grid-template-columns: 1fr !important; } article { min-height: 340px !important; } }`}</style>
    </main>
  );
}

export default LunaraMomentsAtlas;