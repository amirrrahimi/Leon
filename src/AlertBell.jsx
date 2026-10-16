// Header bell (1.3.0): one tap mutes / unmutes signal sounds, the chevron opens alert settings.
import { useState } from "react";
import { Bell, BellOff, ChevronDown, Volume2 } from "lucide-react";
import { beep, vibrate, unlock, askNotify, SOUND_IDS } from "./lib/alerts";

const Seg = ({ val, opts, on }) => (
  <div className="flex flex-wrap gap-1.5">{opts.map(([k, l]) => <button key={k} type="button" onClick={() => on(k)} className={`h-9 rounded-full px-3.5 text-[14px] transition ${val === k ? "bg-[var(--brass)] font-semibold text-[var(--onb)]" : "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"}`}>{l}</button>)}</div>
);

export default function AlertBell({ o, set, t }) {
  const [open, setOpen] = useState(false);
  const toggle = () => { unlock(); const on = !o.alerts; set("alerts", on); if (on) { beep("buy", o); if (o.notifyBg) askNotify(); } };
  return (
    <div className="relative">
      <div className={`flex h-11 items-center rounded-full border transition ${o.alerts ? "border-[var(--saffron)] bg-[#e9a00e1f]" : "border-[var(--line)]"}`}>
        <button type="button" onClick={toggle} aria-pressed={o.alerts} title={o.alerts ? t.alertsOn : t.alertsOff} className={`flex h-full items-center gap-2 rounded-s-full ps-3.5 pe-2 text-[14px] font-semibold ${o.alerts ? "text-[var(--saffron)]" : "text-[var(--muted)]"}`}>
          {o.alerts ? <Bell size={18} className="leon-ring" /> : <BellOff size={18} />}<span className="hidden md:inline">{o.alerts ? t.alertsOn : t.alertsOff}</span>
        </button>
        <button type="button" onClick={() => { unlock(); setOpen((v) => !v); }} aria-expanded={open} aria-label={t.alerts} className="flex h-full items-center rounded-e-full pe-3 ps-1 text-[var(--muted)] hover:text-[var(--ink)]"><ChevronDown size={16} className={open ? "rotate-180 transition" : "transition"} /></button>
      </div>
      {open && (
        <div className="leon-drop absolute end-0 z-40 mt-2 w-[min(92vw,360px)] rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl">
          <div className="mb-3 text-[16px] font-semibold text-[var(--ink)]">{t.alerts}</div>
          <div className="mb-2 text-[14px] text-[var(--muted)]">{t.alertScope}</div>
          <Seg val={o.alertScope} on={(v) => set("alertScope", v)} opts={Object.entries(t.scopes)} />
          <div className="mb-2 mt-4 text-[14px] text-[var(--muted)]">{t.sound}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Seg val={o.sound} on={(v) => { set("sound", v); beep("buy", { ...o, sound: v }); }} opts={SOUND_IDS.map((k) => [k, t.sounds[k]])} />
          </div>
          <div className="mb-2 mt-4 flex items-center justify-between text-[14px] text-[var(--muted)]"><span>{t.volume}</span><span className="font-mono">{Math.round(o.alertVol * 100)}</span></div>
          <div className="flex items-center gap-3">
            <Volume2 size={16} className="text-[var(--muted)]" />
            <input type="range" min={0.1} max={1} step={0.05} value={o.alertVol} onChange={(e) => set("alertVol", +e.target.value)} className="leon-range flex-1" aria-label={t.volume} />
          </div>
          <label className="mt-4 flex items-center gap-2.5 text-[14px] text-[var(--ink)]"><input type="checkbox" checked={o.vib} onChange={(e) => set("vib", e.target.checked)} />{t.vibrate}</label>
          <label className="mt-2.5 flex items-center gap-2.5 text-[14px] text-[var(--ink)]"><input type="checkbox" checked={o.notifyBg} onChange={(e) => { set("notifyBg", e.target.checked); if (e.target.checked) askNotify(); }} />{t.notifyBg}</label>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => { beep("buy", o); if (o.vib) vibrate("buy"); }} className="h-10 flex-1 rounded-full text-[14px] font-bold" style={{ background: "var(--long)", color: "#0b1128" }}>▲ {t.test} {t.buyP}</button>
            <button type="button" onClick={() => { beep("sell", o); if (o.vib) vibrate("sell"); }} className="h-10 flex-1 rounded-full text-[14px] font-bold text-white" style={{ background: "var(--short)" }}>▼ {t.test} {t.sellP}</button>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">{t.alertNote}</p>
        </div>
      )}
    </div>
  );
}
