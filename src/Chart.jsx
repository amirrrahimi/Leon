import { useEffect, useRef, useState } from "react";
import { fmtPrice } from "./lib/market";
import { heikin } from "./lib/indicators";

const pill = (txt) => txt.length * 7 + 14;
const pw0 = () => 80;
export default function Chart({ bars, bt, lang, t, o, setZoom }) {
  const ref = useRef(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState(null);
  useEffect(() => { const ro = new ResizeObserver(([e]) => setW(e.contentRect.width)); ro.observe(ref.current); return () => ro.disconnect(); }, []);
  useEffect(() => { const el = ref.current; const f = (e) => { e.preventDefault(); setZoom((z) => Math.max(30, Math.min(800, Math.round(z * (e.deltaY > 0 ? 1.12 : 0.89))))); }; el.addEventListener("wheel", f, { passive: false }); return () => el.removeEventListener("wheel", f); }, [setZoom]);
  const UP = o.up, DN = o.dn;
  const VOLH = o.volume ? 60 : 0, AX = 76, PAD = 40;
  const H = w < 640 ? 380 : 640;
  const N = Math.min(o.zoom, w < 640 ? Math.min(o.zoom, 70) : o.zoom, bars.length - 20);
  const src = o.style === "ha" ? heikin(bars) : bars;
  const off = bars.length - N;
  const vis = src.slice(off);
  const plotW = w - AX;
  let hi = -Infinity, lo = Infinity;
  vis.forEach((b) => { hi = Math.max(hi, b.h); lo = Math.min(lo, b.l); });
  if (bt.live && o.trades) { hi = Math.max(hi, bt.live.tp, bt.live.sl0); lo = Math.min(lo, bt.live.tp, bt.live.sl0); }
  const pr = hi - lo || 1; hi += pr * 0.05; lo -= pr * 0.05;
  const top = PAD, bot = H - VOLH - 26;
  const y = (p) => top + ((hi - p) / (hi - lo)) * (bot - top);
  const step = plotW / N, cw = Math.max(2, step * 0.62);
  const x = (i) => (i - off) * step + step / 2;
  const maxV = Math.max(...vis.map((b) => b.vlm));
  const last = bars[bars.length - 1];
  const ticks = Array.from({ length: 6 }, (_, k) => lo + ((hi - lo) * (k + 0.5)) / 6);
  const tf = bars[1].t - bars[0].t;
  const loc = lang === "fa" ? "fa-IR" : "en-US";
  const tlabel = (s) => { const d = new Date(s * 1000); return tf >= 86400 ? d.toLocaleDateString(loc, { month: "short", day: "numeric" }) : d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit", hour12: false }); };
  const hb = hover != null ? bars[hover] : last;
  const path = (v) => { let d = ""; v.forEach((p, k) => { if (p == null) return; d += (d ? "L" : "M") + x(k + off).toFixed(1) + " " + y(p).toFixed(1); }); return d; };
  const onMove = (e) => { const r = ref.current.getBoundingClientRect(); const i = Math.floor((e.clientX - r.left) / step) + off; setHover(i >= off && i < bars.length ? i : null); };
  const pct = (p) => (p >= 0 ? "+" : "−") + Math.abs(p * 100).toFixed(2) + "%";
  const res = { tp: [t.res.tp, UP], sl: [t.res.sl, DN], be: [t.res.be, "var(--muted)"], rev: [t.res.rev, "var(--brass)"] };

  const shown = o.trades ? [...bt.trades, ...(bt.live ? [{ ...bt.live, exitI: bars.length - 1, open: true }] : [])].filter((tr) => tr.exitI >= off) : [];

  return (
    <div ref={ref} dir="ltr" className="relative select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <div className="pointer-events-none absolute left-3 top-2 z-10 flex flex-wrap gap-x-3 font-mono text-[14px] text-[var(--muted)]">
        <span>{tlabel(hb.t)}</span>
        <span>O <b className="font-medium text-[var(--ink)]">{fmtPrice(hb.o)}</b></span>
        <span>H <b className="font-medium text-[var(--ink)]">{fmtPrice(hb.h)}</b></span>
        <span>L <b className="font-medium text-[var(--ink)]">{fmtPrice(hb.l)}</b></span>
        <span>C <b className="font-medium" style={{ color: hb.c >= hb.o ? UP : DN }}>{fmtPrice(hb.c)}</b></span>
      </div>
      <svg width={w} height={H} className="block">
        <defs><clipPath id="leon-plot"><rect x={0} y={top - 30} width={plotW} height={bot - top + 60} /></clipPath></defs>
        {ticks.map((p) => (<g key={p}>{o.grid && <line x1={0} x2={plotW} y1={y(p)} y2={y(p)} stroke="var(--grid)" />}<text x={plotW + 8} y={y(p) + 4} className="fill-[var(--muted)] font-mono text-[12px]">{fmtPrice(p)}</text></g>))}
        {o.grid && [0.2, 0.5, 0.8].map((f) => <line key={f} x1={x(off + Math.floor(N * f))} x2={x(off + Math.floor(N * f))} y1={top - 20} y2={H - 26} stroke="var(--grid)" />)}
        {o.volume && vis.map((b, k) => { const h = (b.vlm / maxV) * (VOLH - 6); return <rect key={"v" + b.t} x={x(k + off) - cw / 2} y={H - 26 - h} width={cw} height={h} fill={bars[k + off].c >= bars[k + off].o ? UP : DN} opacity={0.25} />; })}
        {[0.2, 0.5, 0.8].map((f) => { const i = off + Math.floor(N * f); return <text key={f} x={x(i)} y={H - 8} textAnchor="middle" className="fill-[var(--muted)] font-mono text-[12px]">{tlabel(bars[i].t)}</text>; })}

        {/* position boxes, TradingView long/short tool style */}
        {shown.map((tr) => { const x1 = Math.max(0, x(tr.entryI) - step / 2), x2 = Math.min(plotW, x(tr.exitI) + (tr.open ? step * 3 : step / 2)); const win = tr.open ? tr.upnl >= 0 : tr.pnl > 0;
          return (<g key={"box" + tr.entryI}>
            <rect x={x1} y={Math.min(y(tr.entry), y(tr.tp))} width={x2 - x1} height={Math.abs(y(tr.tp) - y(tr.entry))} fill={UP} opacity={tr.open ? 0.16 : 0.09} />
            <rect x={x1} y={Math.min(y(tr.entry), y(tr.sl0))} width={x2 - x1} height={Math.abs(y(tr.sl0) - y(tr.entry))} fill={DN} opacity={tr.open ? 0.16 : 0.09} />
            <line x1={x1} x2={x2} y1={y(tr.entry)} y2={y(tr.entry)} stroke="var(--brass)" strokeOpacity={0.7} />
            {tr.be && <line x1={x1} x2={x2} y1={y(tr.entry)} y2={y(tr.entry)} stroke="var(--ink)" strokeDasharray="3 3" strokeOpacity={0.5} />}
            {!tr.open && <line x1={x(tr.entryI)} y1={y(tr.entry)} x2={x(tr.exitI)} y2={y(tr.exit)} stroke={win ? UP : DN} strokeWidth={1.5} strokeDasharray="4 3" />}
          </g>); })}

        <g clipPath="url(#leon-plot)">{o.lines && bt.lines.map((l, k) => <path key={k} d={path(l.v.slice(off))} fill="none" stroke={l.c} strokeWidth={l.w || 1.4} strokeDasharray={l.dash ? "4 4" : undefined} opacity={0.9} />)}</g>

        {o.style === "line"
          ? <path d={path(vis.map((b) => b.c))} fill="none" stroke="var(--brass)" strokeWidth={2} />
          : vis.map((b, k) => { const i = k + off; const up = b.c >= b.o; const c = up ? UP : DN; const yo = y(Math.max(b.o, b.c)), yc = y(Math.min(b.o, b.c)); const hollow = o.style === "hollow" && up;
            return (<g key={b.t}><line x1={x(i)} x2={x(i)} y1={y(b.h)} y2={y(b.l)} stroke={c} /><rect x={x(i) - cw / 2} y={yo} width={cw} height={Math.max(1, yc - yo)} fill={hollow ? "var(--panel)" : c} stroke={c} strokeWidth={hollow ? 1.2 : 0} rx={0.5} /></g>); })}

        {/* every buy / sell point the strategy found (1.3.0); dashed line marks the 50th most recent point */}
        {o.points && bt.points && bt.points.map((p, k) => { if (p.i < off) return null; const long = p.dir === 1; const cx = x(p.i); const b = bars[p.i]; const cy = long ? y(b.l) + 7 : y(b.h) - 7; const s = Math.max(3.5, Math.min(6, step * 0.4));
          return <path key={"pt" + p.t} d={long ? `M${cx} ${cy - s} L${cx + s} ${cy + s * 0.8} L${cx - s} ${cy + s * 0.8} Z` : `M${cx} ${cy + s} L${cx + s} ${cy - s * 0.8} L${cx - s} ${cy - s * 0.8} Z`} fill={long ? UP : DN} opacity={k === 0 ? 1 : 0.75} className={k === 0 ? "leon-mark" : undefined} />; })}
        {o.points && bt.points && bt.points.length >= 50 && bt.points[49].i >= off && (() => { const px = x(bt.points[49].i) - step / 2; return <g><line x1={px} x2={px} y1={top - 20} y2={H - 26} stroke="var(--brass)" strokeDasharray="2 4" opacity={0.7} /><rect x={px + 4} y={top - 22} width={34} height={18} rx={9} fill="var(--brass)" /><text x={px + 21} y={top - 9} textAnchor="middle" className="fill-[var(--onb)] font-mono text-[11px] font-bold">50</text></g>; })()}

        {/* entry + exit markers */}
        {shown.map((tr) => { const long = tr.dir === 1; const col = long ? UP : DN; const ex = Math.max(x(tr.entryI), pw0(tr) / 2 + 2); const b = bars[tr.entryI]; const ey = long ? y(b.l) + 16 : y(b.h) - 16; const lab = (long ? "▲ " + t.longS : "▼ " + t.shortS); const pw = pill(lab);
          const items = [];
          if (tr.entryI >= off) items.push(<g key="e" className="leon-mark"><rect x={ex - pw / 2} y={ey - 10} width={pw} height={20} rx={10} fill={col} /><text x={ex} y={ey + 4} textAnchor="middle" fill={long ? "#0b1128" : "#ffffff"} className="font-mono text-[11px] font-bold">{lab}</text></g>);
          if (!tr.open) { const [rl, rc] = res[tr.why]; const txt = `${rl} ${pct(tr.pnl)}`; const px = x(tr.exitI), py = y(tr.exit); const pw2 = pill(txt); const above = tr.why === "tp" ? long : tr.why === "sl" ? !long : tr.pnl >= 0 ? long : !long; const ly = above ? py - 22 : py + 22;
            items.push(<g key="x" className="leon-mark"><circle cx={px} cy={py} r={5} fill="var(--panel)" stroke={rc} strokeWidth={2.5} />{tr.why === "sl" && <path d={`M${px - 3} ${py - 3}L${px + 3} ${py + 3}M${px + 3} ${py - 3}L${px - 3} ${py + 3}`} stroke={rc} strokeWidth={1.6} />}<rect x={Math.min(px - pw2 / 2, plotW - pw2)} y={ly - 10} width={pw2} height={20} rx={4} fill="var(--panel)" stroke={rc} /><text x={Math.min(px, plotW - pw2 / 2)} y={ly + 4} textAnchor="middle" fill={rc} className="font-mono text-[11px] font-semibold">{txt}</text></g>); }
          return <g key={"mk" + tr.entryI}>{items}</g>; })}

        {bt.live && o.trades && [["tp", t.target, UP], ["sl", bt.live.be ? t.stop + " = " + t.entry + " (BE)" : t.stop, DN], ...(bt.live.be ? [] : [["entry", t.entry, "var(--brass)"]])].map(([k, lab, col]) => (
          <g key={k}><line x1={x(bt.live.entryI)} x2={plotW} y1={y(bt.live[k])} y2={y(bt.live[k])} stroke={col} strokeDasharray="2 3" /><text x={Math.max(4, x(bt.live.entryI) - step)} y={y(bt.live[k]) + (k === "tp" ? (bt.live.dir === 1 ? -6 : 14) : k === "sl" ? (bt.live.dir === 1 ? 14 : -6) : -6)} textAnchor="end" fill={col} className="font-mono text-[12px] font-semibold">{lab} {fmtPrice(bt.live[k])}</text></g>))}

        <line x1={0} x2={plotW} y1={y(last.c)} y2={y(last.c)} stroke={last.c >= last.o ? UP : DN} strokeDasharray="1 3" />
        <g transform={`translate(${plotW},${y(last.c) - 11})`}><rect width={AX} height={22} rx={3} fill={last.c >= last.o ? UP : DN} /><text x={8} y={15} className="fill-[#0b1128] font-mono text-[12px] font-semibold">{fmtPrice(last.c)}</text></g>
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H - 26} stroke="var(--brass)" opacity={0.35} />}
      </svg>
    </div>
  );
}
