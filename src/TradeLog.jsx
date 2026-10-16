import { useState } from "react";
import { fmtPrice } from "./lib/market";
import { num } from "./lib/i18n";

// 1.3.1: rows that hit the take-profit are highlighted green, rows that hit the stop loss red.
// Target / stop prices are shown, with the level that was actually hit marked.
const HL = {
  tp: { bg: "rgba(156,194,63,.14)", bar: "var(--long)" },
  sl: { bg: "rgba(255,114,71,.14)", bar: "var(--short)" },
};

export default function TradeLog({ bt, bars, t, lang, o }) {
  const [more, setMore] = useState(false);
  const tf = bars[1].t - bars[0].t; const loc = lang === "fa" ? "fa-IR" : "en-US";
  const when = (i) => { const d = new Date(bars[i].t * 1000); return tf >= 86400 ? d.toLocaleDateString(loc, { month: "short", day: "numeric" }) : d.toLocaleString(loc, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }); };
  const all = [...(bt.live ? [{ ...bt.live, open: true }] : []), ...bt.trades.slice().reverse()];
  const rows = all.slice(0, more ? 40 : 10);
  const tpN = bt.trades.filter((r) => r.why === "tp").length, slN = bt.trades.filter((r) => r.why === "sl").length;
  const resCol = (r) => (r.open ? "var(--brass)" : r.why === "tp" ? "var(--long)" : r.why === "sl" ? "var(--short)" : r.pnl > 0 ? "var(--long)" : r.pnl < 0 ? "var(--short)" : "var(--muted)");
  const side = lang === "fa" ? "right" : "left";
  return (
    <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-[18px] font-semibold text-[var(--ink)]">{t.tradesTitle}</h2>
        <span className="rounded-full px-3 py-1 text-[13px] font-bold" style={{ background: HL.tp.bg, color: "var(--long)" }}>✓ {t.resFull.tp} · {num(lang, tpN)}</span>
        <span className="rounded-full px-3 py-1 text-[13px] font-bold" style={{ background: HL.sl.bg, color: "var(--short)" }}>✕ {t.resFull.sl} · {num(lang, slN)}</span>
        <span className="ms-auto text-[14px] text-[var(--muted)]">{num(lang, bt.n)} {t.trades}</span>
      </div>
      {!rows.length ? <p className="text-[15px] text-[var(--muted)]">{t.noTrades}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-y-1 text-[15px]">
            <thead><tr className="text-[14px] text-[var(--muted)]">{[t.side, t.opened, t.entry, `${t.target} / ${t.stop}`, t.closedAt, t.result, ""].map((h, k) => <th key={k} className={`px-2 py-2 font-normal ${k === 6 ? "text-end" : "text-start"}`}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => { const p = r.open ? r.upnl : r.pnl; const h = !r.open && HL[r.why];
              const cell = "px-2 py-2.5"; const first = h ? { boxShadow: `inset ${lang === "fa" ? "-4px" : "4px"} 0 0 ${h.bar}` } : {};
              return (
              <tr key={r.entryI} style={{ background: h ? h.bg : "transparent" }}>
                <td className={`${cell} rounded-s-xl`} style={first}><span className="rounded-full px-2.5 py-1 text-[13px] font-bold" style={{ background: r.dir === 1 ? o.up : o.dn, color: r.dir === 1 ? "#0b1128" : "#ffffff" }}>{r.dir === 1 ? "▲ " + t.longS : "▼ " + t.shortS}</span></td>
                <td className={`${cell} text-[14px] text-[var(--muted)]`}>{when(r.entryI)}</td>
                <td dir="ltr" className={`${cell} font-mono text-[14px] text-[var(--ink)]`} style={{ textAlign: side }}>{fmtPrice(r.entry)}</td>
                <td dir="ltr" className={`${cell} font-mono text-[13px]`} style={{ textAlign: side }}>
                  <span style={{ color: "var(--long)", fontWeight: r.why === "tp" ? 700 : 400, opacity: r.why === "sl" ? 0.7 : 1, textDecoration: r.why === "tp" ? "underline" : "none", textUnderlineOffset: 3 }}>{fmtPrice(r.tp)}</span>
                  <span className="text-[var(--muted)]"> / </span>
                  <span style={{ color: "var(--short)", fontWeight: r.why === "sl" ? 700 : 400, opacity: r.why === "tp" ? 0.7 : 1, textDecoration: r.why === "sl" ? "underline" : "none", textUnderlineOffset: 3 }}>{fmtPrice(r.sl0)}</span>
                </td>
                <td dir="ltr" className={`${cell} font-mono text-[14px] text-[var(--ink)]`} style={{ textAlign: side }}>{r.open ? "…" : fmtPrice(r.exit)}</td>
                <td className={`${cell} text-[14px] font-semibold`} style={{ color: resCol(r) }}>{r.open ? <span className="inline-flex items-center gap-2"><span className="leon-pulse h-2 w-2 rounded-full bg-[var(--brass)]" />{t.resFull.open}</span> : <>{r.why === "tp" ? "✓ " : r.why === "sl" ? "✕ " : ""}{t.resFull[r.why]}</>}</td>
                <td dir="ltr" className={`${cell} rounded-e-xl font-mono text-[14px] font-semibold`} style={{ textAlign: lang === "fa" ? "left" : "right", color: p > 1e-9 ? "var(--long)" : p < -1e-9 ? "var(--short)" : "var(--muted)" }}>{p >= 0 ? "+" : "−"}{Math.abs(p * 100).toFixed(2)}%</td>
              </tr>); })}</tbody>
          </table>
        </div>
      )}
      {all.length > 10 && <button type="button" onClick={() => setMore((v) => !v)} className="mt-3 h-9 rounded-full border border-[var(--line)] px-4 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]">{more ? "−" : `+ ${num(lang, Math.min(all.length, 40) - 10)}`}</button>}
    </div>
  );
}
