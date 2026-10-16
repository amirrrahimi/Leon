// The astrolabe: brass limb with a 0–100 scale, a slowly turning rete, and a needle at the live win rate
export default function Dial({ value, label, lang, delta }) {
  const S = 280, C = S / 2, R = 118;
  const a0 = -225, sweep = 270;
  const ang = a0 + sweep * value;
  const pt = (deg, r) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];
  const arc = (r, from, to) => { const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r); return `M${x1} ${y1} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
  const col = value >= 0.6 ? "var(--long)" : value >= 0.45 ? "var(--saffron)" : "var(--short)";
  const shown = Math.round(value * 100);
  const n = lang === "fa" ? shown.toLocaleString("fa-IR") : shown;
  return (
    <div className="relative mx-auto" style={{ width: S, height: S }} dir="ltr">
      <svg width={S} height={S} className="absolute inset-0">
        <circle cx={C} cy={C} r={R + 16} fill="none" stroke="var(--brass)" strokeOpacity={0.35} />
        <path d={arc(R, a0, a0 + sweep)} stroke="var(--grid)" strokeWidth={10} fill="none" strokeLinecap="round" />
        <path d={arc(R, a0, a0 + Math.max(0.5, sweep * value))} stroke={col} strokeWidth={10} fill="none" strokeLinecap="round" style={{ transition: "all .8s cubic-bezier(.2,.8,.2,1)" }} />
        {Array.from({ length: 51 }, (_, k) => { const d = a0 + (sweep * k) / 50; const major = k % 5 === 0; const [x1, y1] = pt(d, R + 8); const [x2, y2] = pt(d, R + (major ? 15 : 11)); return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--brass)" strokeOpacity={major ? 0.9 : 0.45} />; })}
        {[0, 25, 50, 75, 100].map((v) => { const [tx, ty] = pt(a0 + (sweep * v) / 100, R - 18); return <text key={v} x={tx} y={ty + 4} textAnchor="middle" className="fill-[var(--muted)] font-mono text-[11px]">{lang === "fa" ? v.toLocaleString("fa-IR") : v}</text>; })}
        <g className="leon-rete" style={{ transformOrigin: `${C}px ${C}px` }}>
          <circle cx={C} cy={C} r={R - 34} fill="none" stroke="var(--brass)" strokeOpacity={0.22} strokeDasharray="1 5" />
          {Array.from({ length: 12 }, (_, k) => { const [x1, y1] = pt(k * 30, R - 40), [x2, y2] = pt(k * 30, R - 28); return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--brass)" strokeOpacity={0.3} />; })}
        </g>
        <g style={{ transform: `rotate(${ang + 90}deg)`, transformOrigin: `${C}px ${C}px`, transition: "transform .9s cubic-bezier(.2,1.4,.3,1)" }}>
          <path d={`M${C - 3} ${C} L${C} ${C - R + 4} L${C + 3} ${C} Z`} fill="var(--brass)" />
          <circle cx={C} cy={C - R + 4} r={3} fill={col} />
        </g>
        <circle cx={C} cy={C} r={7} fill="var(--panel)" stroke="var(--brass)" strokeWidth={2} />
      </svg>
      <div className="absolute inset-x-0 top-[58%] text-center">
        <div className="font-[Outfit] text-[44px] font-semibold leading-none tracking-tight" style={{ color: col }}>{lang === "fa" ? "٪" + n : n + "%"}</div>
        <div className="mt-1 text-[14px] text-[var(--muted)]">{label}{delta ? <span className={delta > 0 ? "text-[var(--long)]" : "text-[var(--short)]"}> {delta > 0 ? "▲" : "▼"}</span> : null}</div>
      </div>
    </div>
  );
}
