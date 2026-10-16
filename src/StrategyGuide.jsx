// Strategy guide (1.3.0): which strategy suits which kind of trade.
import { STRATS, FITS } from "./lib/strategies";
import { MODES } from "./lib/market";

export default function StrategyGuide({ t, lang, mode, onPick, activeId }) {
  return (
    <section className="mt-8">
      <h2 className="text-[22px] font-semibold text-[var(--ink)]">{t.guide}</h2>
      <p className="mt-1 text-[14px] text-[var(--muted)]">{t.guideSub}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {FITS.map((f) => {
          const list = STRATS.filter((s) => s.fit.includes(f)).sort((a, b) => (a.fit[0] === f ? 0 : 1) - (b.fit[0] === f ? 0 : 1));
          return (
            <div key={f} className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-4">
              <div className="text-[17px] font-semibold text-[var(--saffron)]">{t.fits[f]}</div>
              <div className="mt-0.5 min-h-[40px] text-[14px] leading-snug text-[var(--muted)]">{t.fitHint[f]}</div>
              <div className="mt-3 flex flex-col gap-1">
                {list.map((s) => { const here = s.modes.includes(mode); const on = s.id === activeId;
                  return (
                    <button key={s.id} type="button" onClick={() => onPick(s)} className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-start text-[14px] transition ${on ? "bg-[var(--brass)] text-[var(--onb)]" : "hover:bg-[var(--hover)]"}`}>
                      <span className={`${s.fit[0] === f ? "font-semibold" : ""} ${on ? "" : "text-[var(--ink)]"}`}>{t.s[s.id][0]}</span>
                      <span className={`shrink-0 text-[12px] ${on ? "" : here ? "text-[var(--brass)]" : "text-[var(--muted)]"}`}>{s.fit[0] === f ? "★" : ""}{here ? "" : " ↗ " + t.modes[s.modes.includes("mid") ? "mid" : s.modes[0]]}</span>
                    </button>); })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
