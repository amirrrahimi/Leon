// Recent buy / sell points: every strategy keeps loading older candles until it has found at least
// MIN_POINTS (50) points, or the exchange has no older history for this coin + timeframe.
// 1.4.0: "found" (how many signals) is shown apart from "accuracy" (how many of them hit target vs stop),
// and every point is coloured by what actually happened to it.
import { useState } from "react";
import { fmtPrice } from "./lib/market";
import { MIN_POINTS } from "./lib/strategies";
import { num, pct } from "./lib/i18n";

const RES = { tp: ["var(--long)", "rgba(156,194,63,.14)", "✓"], sl: ["var(--short)", "rgba(255,114,71,.14)", "✕"] };

export default function Points({ bt, bars, t, lang, o, set, deepening, exhausted, name }) {
  const [all, setAll] = useState(false);
  const pts = bt.points.slice(0, MIN_POINTS);
  const n = bt.points.length, ok = n >= MIN_POINTS;
  const c = { tp: 0, sl: 0, be: 0, rev: 0, open: 0, skip: 0 }; pts.forEach((p) => { c[p.res] = (c[p.res] || 0) + 1; });
  const won = pts.filter((p) => p.res === "tp" || (p.res === "rev" && p.pnl > 0)).length, lost = pts.filter((p) => p.res === "sl" || (p.res === "rev" && p.pnl < 0)).length;
  const acc = won + lost ? won / (won + lost) : 0; const accCol = acc >= 0.6 ? "var(--long)" : acc >= 0.5 ? "var(--saffron)" : "var(--short)";
  const tf = bars[1].t - bars[0].t; const loc = lang === "fa" ? "fa-IR" : "en-US";
  const when = (s) => { const d = new Date(s * 1000); return tf >= 86400 ? d.toLocaleDateString(loc, { year: "2-digit", month: "short", day: "numeric" }) : d.toLocaleString(loc, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }); };
  const shown = all ? pts : pts.slice(0, 12);
  const fit = () => { const p = pts[pts.length - 1]; if (p) set("zoom", Math.min(800, Math.max(30, bars.length - p.i + 6))); set("points", true); };
  const status = ok ? t.pointsOk : deepening ? t.pointsDeep : t.pointsAll;
  const fCol = ok ? "var(--brass)" : deepening ? "var(--saffron)" : "var(--short)";
  const chip = (k, v, col, bg) => v ? <span key={k} className="rounded-full px-3 py-1 text-[13px] font-bold" style={{ color: col, background: bg }}>{t.res2[k]} · {num(lang, v)}</span> : null;
  return (
    <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-[18px] font-semibold text-[var(--ink)]">{t.points}</h2>
        <span className="text-[14px] font-semibold text-[var(--brass)]">{name}</span>
        <button type="button" onClick={fit} className="ms-auto h-9 rounded-full border border-[var(--brass)] px-3.5 text-[14px] font-semibold text-[var(--brass)] hover:bg-[#c9a24a1f]">{t.pointsShow}</button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-[var(--hover)] p-3.5">
          <div className="text-[14px] text-[var(--muted)]">{t.ptsFound}</div>
          <div className="mt-1 flex items-baseline gap-2"><span className="font-mono text-[28px] font-semibold leading-none" style={{ color: fCol }}>{num(lang, Math.min(n, MIN_POINTS))}</span><span className="text-[14px] text-[var(--muted)]">{status}</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--grid)]"><div className={`h-full rounded-full ${deepening ? "leon-pulse" : ""}`} style={{ width: `${Math.min(1, n / MIN_POINTS) * 100}%`, background: fCol, transition: "width .6s" }} /></div>
          <div className="mt-1.5 text-[13px] text-[var(--muted)]">{num(lang, n)} {t.pointsIn} {num(lang, bt.scanned)} {t.candles} · {t.ptsNote}</div>
        </div>
        <div className="rounded-2xl p-3.5" style={{ background: acc >= 0.5 ? "rgba(156,194,63,.10)" : "rgba(255,114,71,.10)" }}>
          <div className="text-[14px] text-[var(--muted)]">{t.ptsAcc}</div>
          <div className="mt-1 flex items-baseline gap-2"><span className="font-mono text-[28px] font-semibold leading-none" style={{ color: accCol }}>{pct(lang, acc)}</span><span dir="ltr" className="font-mono text-[14px] text-[var(--muted)]">{won} / {lost}</span></div>
          <div className="mt-2 flex flex-wrap gap-1.5">{chip("tp", c.tp, "var(--long)", "rgba(156,194,63,.16)")}{chip("sl", c.sl, "var(--short)", "rgba(255,114,71,.16)")}{chip("be", c.be, "var(--ink)", "var(--grid)")}{chip("rev", c.rev, "var(--brass)", "var(--grid)")}{chip("skip", c.skip, "var(--muted)", "var(--grid)")}{chip("open", c.open, "var(--brass)", "var(--grid)")}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        {shown.map((p, k) => { const r = RES[p.res] || (p.res === "rev" ? (p.pnl > 0 ? RES.tp : p.pnl < 0 ? RES.sl : null) : null); return (
          <div key={p.t} className="rounded-xl border px-3 py-2" style={{ borderColor: r ? r[0] : k === 0 ? "var(--brass)" : "var(--line)", background: r ? r[1] : "transparent" }}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold" style={{ color: p.dir === 1 ? o.up : o.dn }}>{p.dir === 1 ? "▲ " + t.buyP : "▼ " + t.sellP}</span>
              <span className="font-mono text-[12px] text-[var(--muted)]">#{num(lang, k + 1)}</span>
            </div>
            <div dir="ltr" className={`font-mono text-[14px] text-[var(--ink)] ${lang === "fa" ? "text-right" : ""}`}>{fmtPrice(p.px)}</div>
            <div className="text-[12px] text-[var(--muted)]">{when(p.t)}</div>
            <div className="mt-1 text-[12px] font-semibold" style={{ color: r ? r[0] : "var(--muted)" }}>{r ? r[2] + " " : ""}{t.res2[p.res]}{p.pnl != null && p.res !== "skip" ? <span dir="ltr" className="ms-1 font-mono">{p.pnl >= 0 ? "+" : "−"}{Math.abs(p.pnl * 100).toFixed(2)}%</span> : null}</div>
          </div>); })}
      </div>
      {pts.length > 12 && <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 h-9 rounded-full border border-[var(--line)] px-4 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]">{all ? "−" : `+ ${num(lang, pts.length - 12)} ${t.pointsMore}`}</button>}
    </div>
  );
}
