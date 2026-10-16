export const DEFAULTS = { theme: "night", style: "candle", up: "#9cc23f", dn: "#ef5a2c", volume: true, lines: true, trades: true, grid: true, zoom: 96, rr: "auto", points: true,
  strict: true, goal: "accuracy", provenOnly: false,
  alerts: true, alertScope: "proven", sound: "chime", alertVol: 0.7, vib: true, notifyBg: true };
const PRESETS = [["#9cc23f", "#ef5a2c"], ["#26a69a", "#ef5350"], ["#2f7cf6", "#e8457a"], ["#e9a00e", "#8f95d6"], ["#d6d0bd", "#5c6390"]];

const Seg = ({ val, opts, on }) => (
  <div className="flex flex-wrap gap-1.5">{opts.map(([k, l]) => <button key={k} onClick={() => on(k)} className={`h-9 rounded-full px-3.5 text-[14px] transition ${val === k ? "bg-[var(--brass)] font-semibold text-[var(--onb)]" : "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"}`}>{l}</button>)}</div>
);
const Label = ({ children }) => <div className="mb-2 text-[14px] text-[var(--muted)]">{children}</div>;

export default function Settings({ o, set, t, reset }) {
  return (
    <div className="leon-drop mb-4 grid gap-5 rounded-2xl border border-[var(--line)] bg-[var(--hover)] p-4 sm:grid-cols-2 xl:grid-cols-3">
      <div><Label>{t.theme}</Label><Seg val={o.theme} on={(v) => set("theme", v)} opts={[["night", "☾ " + t.night], ["day", "☀ " + t.day]]} /></div>
      <div><Label>{t.candles}</Label><Seg val={o.style} on={(v) => set("style", v)} opts={Object.entries(t.styles)} /></div>
      <div><Label>{t.tpSet}</Label><Seg val={o.rr} on={(v) => set("rr", v)} opts={[["auto", t.auto], [1, "1R"], [1.5, "1.5R"], [2, "2R"], [3, "3R"]]} /></div>
      <div>
        <Label>{t.colors}</Label>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(([u, d]) => { const on = o.up === u && o.dn === d; return (
            <button key={u + d} onClick={() => { set("up", u); set("dn", d); }} aria-label={`${u} ${d}`} className={`flex h-9 overflow-hidden rounded-full border-2 ${on ? "border-[var(--brass)]" : "border-transparent"}`}><span className="w-5" style={{ background: u }} /><span className="w-5" style={{ background: d }} /></button>); })}
          <label className="ms-1 flex items-center gap-1.5 text-[14px] text-[var(--muted)]">{t.upC}<input type="color" value={o.up} onChange={(e) => set("up", e.target.value)} className="h-8 w-9 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
          <label className="flex items-center gap-1.5 text-[14px] text-[var(--muted)]">{t.dnC}<input type="color" value={o.dn} onChange={(e) => set("dn", e.target.value)} className="h-8 w-9 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
        </div>
      </div>
      <div>
        <Label>{t.show}</Label>
        <div className="flex flex-wrap gap-1.5">{Object.entries(t.showOpts).map(([k, l]) => <button key={k} onClick={() => set(k, (v) => !v)} aria-pressed={o[k]} className={`h-9 rounded-full px-3.5 text-[14px] transition ${o[k] ? "border border-[var(--brass)] text-[var(--brass)]" : "border border-[var(--line)] text-[var(--muted)] line-through"}`}>{l}</button>)}</div>
      </div>
      <div>
        <Label>{t.zoom} · <span className="font-mono">{o.zoom}</span></Label>
        <div className="flex items-center gap-3">
          <input type="range" min={30} max={800} value={o.zoom} onChange={(e) => set("zoom", +e.target.value)} className="leon-range flex-1" aria-label={t.zoom} />
          <button onClick={reset} className="h-9 rounded-full border border-[var(--line)] px-3.5 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]">{t.reset}</button>
        </div>
      </div>
    </div>
  );
}
