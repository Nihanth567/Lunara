import { useMemo, useState } from "react";

type Filter = "all" | "grateful" | "cute" | "grow";

type Moment = {
  date: string;
  day: string;
  month: string;
  label: string;
  preview: string;
  partner?: string;
  type: Exclude<Filter, "all">;
  color: string;
  moon: string;
};

const moments: Moment[] = [
  {
    date: "Saturday, June 15",
    day: "15",
    month: "JUN",
    label: "Grateful",
    preview: "You made coffee before I even asked.",
    partner: "Your laugh made the whole kitchen warmer.",
    type: "grateful",
    color: "#ff9a8b",
    moon: "◒",
  },
  {
    date: "Friday, June 14",
    day: "14",
    month: "JUN",
    label: "Cute",
    preview: "The tiny dance you did while looking for your keys.",
    partner: "I still have the photo of your sleepy face.",
    type: "cute",
    color: "#c3b1e1",
    moon: "◓",
  },
  {
    date: "Thursday, June 13",
    day: "13",
    month: "JUN",
    label: "Grow",
    preview: "A slower Sunday, with nowhere we need to be.",
    partner: "Let's keep choosing the unhurried version.",
    type: "grow",
    color: "#a8d8a8",
    moon: "◑",
  },
  {
    date: "Wednesday, June 12",
    day: "12",
    month: "JUN",
    label: "Grateful",
    preview: "You always make room for the hard conversations.",
    type: "grateful",
    color: "#ff9a8b",
    moon: "◐",
  },
];

const filters: { key: Filter; label: string; color: string }[] = [
  { key: "all", label: "Every moment", color: "#f8f5ff" },
  { key: "grateful", label: "Grateful", color: "#ff9a8b" },
  { key: "cute", label: "Cute", color: "#c3b1e1" },
  { key: "grow", label: "Grow", color: "#a8d8a8" },
];

function Spark({ top, left, size = 2, opacity = 0.6 }: { top: string; left: string; size?: number; opacity?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top,
        left,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#f8f5ff",
        opacity,
        boxShadow: `0 0 ${size * 3}px rgba(248,245,255,.65)`,
      }}
    />
  );
}

export function LunaraMomentsConstellation() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState(0);
  const [showPartner, setShowPartner] = useState(false);
  const visible = useMemo(
    () => moments.filter((moment) => filter === "all" || moment.type === filter),
    [filter],
  );
  const active = visible[selected] ?? visible[0];

  function changeFilter(next: Filter) {
    setFilter(next);
    setSelected(0);
    setShowPartner(false);
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "radial-gradient(circle at 76% 8%, #30254e 0%, #17132f 34%, #0e0b24 78%)",
        color: "#f8f5ff",
        fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Spark top="11%" left="12%" size={3} opacity={0.8} />
      <Spark top="18%" left="84%" size={2} />
      <Spark top="48%" left="9%" size={2} opacity={0.4} />
      <Spark top="67%" left="91%" size={3} opacity={0.7} />
      <Spark top="82%" left="18%" size={2} opacity={0.45} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "34px 24px 54px", position: "relative" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 34 }}>
          <div>
            <div style={{ color: "#ff9a8b", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>
              Your shared orbit
            </div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(38px, 6vw, 65px)", lineHeight: 0.98, fontWeight: 400, margin: 0, letterSpacing: "-0.04em" }}>
              Moments
            </h1>
            <p style={{ color: "#9b89c2", fontSize: 14, margin: "15px 0 0" }}>A constellation of the little things that keep you close.</p>
          </div>
          <button
            type="button"
            onClick={() => window.alert("Your shared orbit is 12 nights strong.")}
            style={{ border: "1px solid rgba(195,177,225,.28)", background: "rgba(255,255,255,.05)", borderRadius: 999, color: "#c3b1e1", padding: "10px 15px", fontSize: 12, cursor: "pointer" }}
          >
            12 nights <span style={{ marginLeft: 6 }}>↗</span>
          </button>
        </header>

        <nav aria-label="Moment filters" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 5, marginBottom: 28 }}>
          {filters.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => changeFilter(item.key)}
              style={{
                whiteSpace: "nowrap",
                border: filter === item.key ? `1px solid ${item.color}` : "1px solid rgba(255,255,255,.1)",
                background: filter === item.key ? `${item.color}18` : "rgba(255,255,255,.035)",
                color: filter === item.key ? item.color : "#9b89c2",
                borderRadius: 999,
                padding: "10px 16px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(190px, .55fr) minmax(0, 1fr)", gap: 26, alignItems: "stretch" }}>
          <div style={{ borderLeft: "1px solid rgba(195,177,225,.25)", padding: "5px 0 10px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 438 }}>
            <div>
              <div style={{ color: "#7a6d98", fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 14 }}>The archive</div>
              {visible.map((moment, index) => (
                <button
                  type="button"
                  key={moment.date}
                  onClick={() => { setSelected(index); setShowPartner(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left", background: "none", border: 0, color: selected === index ? "#f8f5ff" : "#7a6d98", padding: "13px 0", cursor: "pointer" }}
                >
                  <span style={{ color: selected === index ? moment.color : "#6c608a", fontSize: 11, fontVariantNumeric: "tabular-nums", width: 28 }}>{moment.day}</span>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: moment.color, opacity: selected === index ? 1 : .35, boxShadow: selected === index ? `0 0 13px ${moment.color}` : "none" }} />
                  <span style={{ fontSize: 13 }}>{moment.month}<span style={{ display: "block", color: "#6f638d", fontSize: 11, marginTop: 2 }}>{moment.label}</span></span>
                </button>
              ))}
              {visible.length === 0 && <p style={{ color: "#7a6d98", fontSize: 13 }}>No moments in this orbit yet.</p>}
            </div>
            <div style={{ color: "#7a6d98", fontSize: 12, lineHeight: 1.6, maxWidth: 160 }}>Every honest note becomes a small light you can return to.</div>
          </div>

          {active ? (
            <article style={{ border: `1px solid ${active.color}55`, background: "linear-gradient(145deg, rgba(39,31,70,.9), rgba(25,20,50,.72))", borderRadius: 20, padding: "clamp(24px, 5vw, 48px)", position: "relative", overflow: "hidden", minHeight: 438 }}>
              <div style={{ position: "absolute", right: 24, top: 20, color: active.color, fontSize: 28, opacity: .9 }}>{active.moon}</div>
              <div style={{ color: active.color, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase" }}>{active.label} · {active.date}</div>
              <div style={{ width: 54, height: 1, background: active.color, margin: "27px 0 30px", opacity: .7 }} />
              <blockquote style={{ fontFamily: "Georgia, serif", fontSize: "clamp(26px, 4vw, 42px)", lineHeight: 1.18, fontWeight: 400, margin: 0, letterSpacing: "-.025em", maxWidth: 590 }}>
                “{showPartner && active.partner ? active.partner : active.preview}”
              </blockquote>
              <div style={{ position: "absolute", bottom: 31, left: "clamp(24px, 5vw, 48px)", right: "clamp(24px, 5vw, 48px)", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 18 }}>
                <span style={{ color: "#9b89c2", fontSize: 12 }}>{showPartner ? "From your partner" : "From you"}</span>
                {active.partner && <button type="button" onClick={() => setShowPartner((value) => !value)} style={{ color: active.color, background: "none", border: 0, fontSize: 12, cursor: "pointer", padding: 4 }}>{showPartner ? "Read yours" : "Read theirs"} <span style={{ marginLeft: 5 }}>→</span></button>}
              </div>
            </article>
          ) : (
            <div style={{ border: "1px dashed rgba(195,177,225,.25)", borderRadius: 20, display: "grid", placeItems: "center", minHeight: 438, color: "#9b89c2", fontSize: 14 }}>Select a moment to open it.</div>
          )}
        </section>

        <footer style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 34, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.08)", color: "#7a6d98", fontSize: 12 }}>
          <span>Tonight’s ritual is waiting</span>
          <button type="button" onClick={() => window.alert("Opening tonight's ritual…")} style={{ color: "#ff9a8b", background: "none", border: 0, fontSize: 12, cursor: "pointer" }}>Add a new moment <span style={{ marginLeft: 5 }}>＋</span></button>
        </footer>
      </div>
      <style>{`
        @media (max-width: 680px) {
          main > div { padding-left: 18px !important; padding-right: 18px !important; }
          section { grid-template-columns: 1fr !important; }
          section > div:first-child { min-height: auto !important; border-left: 0 !important; border-bottom: 1px solid rgba(195,177,225,.25); padding: 0 0 12px !important; }
          section > div:first-child > div:first-child { display: flex; gap: 18px; overflow-x: auto; }
          section > div:first-child button { min-width: 108px; }
          article { min-height: 390px !important; }
        }
      `}</style>
    </main>
  );
}

export default LunaraMomentsConstellation;