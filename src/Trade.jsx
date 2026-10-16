import { PREVIEW } from "./lib/preview";
// Trading desk: Test account · Exchanges (real accounts) · Bots · Activity
import { useMemo, useState } from "react";
import { FlaskConical, Link2, Bot, ScrollText, Lock, Unlock, Play, Pause, Trash2, X, ShieldAlert, Check, OctagonX, KeyRound } from "lucide-react";
import { EXCHANGES, exchange, NATIVE_SLTP } from "./lib/exchanges";
import { simulate, equity, upnl, liqPrice } from "./lib/paper";
import { fmtPrice } from "./lib/market";
import { canTradeLive } from "./lib/platform";
import { num, pct } from "./lib/i18n";

const money = (lang, x, d = 2) => (x < 0 ? "−" : "") + "$" + num(lang, Math.abs(x), { maximumFractionDigits: d, minimumFractionDigits: d });
const sgn = (x) => (x > 1e-9 ? "var(--long)" : x < -1e-9 ? "var(--short)" : "var(--muted)");
const card = "rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5";
const input = "h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--brass)]";
const Label = ({ children }) => <div className="mb-1.5 text-[14px] text-[var(--muted)]">{children}</div>;
const Seg = ({ val, opts, on }) => (
  <div className="flex flex-wrap gap-1.5">{opts.map(([k, l]) => <button key={k} type="button" onClick={() => on(k)} className={`h-9 rounded-full px-3.5 text-[14px] transition ${String(val) === String(k) ? "bg-[var(--brass)] font-semibold text-[var(--onb)]" : "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"}`}>{l}</button>)}</div>
);
const Btn = ({ tone = "line", className = "", ...p }) => {
  const st = { long: "bg-[var(--long)] text-[#0b1128]", short: "bg-[var(--short)] text-white", brass: "bg-[var(--brass)] text-[var(--onb)]", line: "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--hover)]", danger: "border border-[var(--short)] text-[var(--short)] hover:bg-[#ff724715]" }[tone];
  return <button type="button" {...p} className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${st} ${className}`} />;
};
const Badge = ({ live, tt }) => <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${live ? "bg-[var(--short)] text-white" : "bg-[var(--hover)] text-[var(--brass)]"}`}>{live ? tt.liveB : tt.testB}</span>;
const Spark = ({ curve, w = 220, h = 46 }) => {
  if (!curve || curve.length < 2) return null; const mn = Math.min(...curve), mx = Math.max(...curve), r = mx - mn || 1;
  const d = curve.map((v, i) => `${i ? "L" : "M"}${((i / (curve.length - 1)) * w).toFixed(1)},${(h - ((v - mn) / r) * (h - 4) - 2).toFixed(1)}`).join("");
  return <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[46px]"><path d={d} fill="none" stroke={curve[curve.length - 1] >= curve[0] ? "var(--long)" : "var(--short)"} strokeWidth="1.8" /></svg>;
};
const errText = (tt, m) => tt.errs[m] || m;

// ------------------------------------------------------------------ pending approvals (shown at the top of the app)
export function PendingBar({ tr, tt, t, lang }) {
  if (!tr.pending.length && !tr.day.paused) return null;
  return (
    <div className="mt-5 flex flex-col gap-2">
      {tr.day.paused && <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--short)] bg-[#ff724712] px-4 py-3 text-[14px]"><ShieldAlert size={18} className="text-[var(--short)]" /><span className="text-[var(--ink)]">{tt.pausedMsg} {money(lang, tr.day.pnl)}</span><Btn className="ms-auto" onClick={tr.resume}>{tt.resume}</Btn></div>}
      {tr.pending.map((p) => { const ex = exchange(p.account); return (
        <div key={p.id} className="leon-drop flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--saffron)] bg-[#e9a00e14] px-4 py-3">
          <span className="leon-pulse h-2.5 w-2.5 rounded-full bg-[var(--saffron)]" />
          <span className="text-[15px] text-[var(--ink)]"><b>{tt.wants}</b> <b style={{ color: p.dir === 1 ? "var(--long)" : "var(--short)" }}>{p.market === "spot" ? (p.dir === 1 ? t.kinds.buy : t.kinds.sell) : p.dir === 1 ? t.fut.openLong : t.fut.openShort}</b> <span dir="ltr">{p.sym}/USDT @ {fmtPrice(p.price)}</span> · {ex ? ex.name : tt.paper} <Badge live={p.account !== "paper"} tt={tt} /></span>
          <span dir="ltr" className="font-mono text-[13px] text-[var(--muted)]">SL {fmtPrice(p.sl)} · TP {fmtPrice(p.tp)}</span>
          <div className="ms-auto flex gap-2"><Btn tone="brass" onClick={() => tr.approve(p.id)}><Check size={16} />{tt.approve}</Btn><Btn onClick={() => tr.reject(p.id)}>{tt.skip}</Btn></div>
        </div>); })}
    </div>
  );
}

// ------------------------------------------------------------------ test account
function PaperTab({ tr, tt, t, lang, sym, price, sel, strats, mode }) {
  const a = tr.paper; const eq = equity(a, { [sym]: price }); const pl = eq - a.start;
  const [start, setStart] = useState(a.start); const [fee, setFee] = useState(a.fee); const [confirmReset, setConfirmReset] = useState(false);
  const [mk, setMk] = useState("futures"); const [lev, setLev] = useState(5); const [size, setSize] = useState(10); const [useSL, setUseSL] = useState(true);
  const [simO, setSimO] = useState({ sizePct: 10, lev: 1, market: "futures" });
  const sim = useMemo(() => simulate(sel.bt, { balance: a.start, fee: a.fee, ...simO }), [sel.bt, a.start, a.fee, simO]);
  const all = useMemo(() => strats.map((r) => ({ id: r.s.id, ...simulate(r.bt, { balance: a.start, fee: a.fee, ...simO }) })).sort((x, y) => y.final - x.final), [strats, a.start, a.fee, simO]);
  const bracket = (dir) => { if (!useSL || !sel.bt.live || sel.bt.live.dir !== dir) { const A = Math.abs(price) * 0.01; return { sl: price - dir * A * 1.5, tp: price + dir * A * 3 }; } const d = Math.abs(sel.bt.live.entry - sel.bt.live.sl0); return { sl: price - dir * d, tp: price + dir * d * sel.s.rr }; };
  const go = (dir) => tr.paperManual({ sym, market: mk, dir, margin: (eq * size) / 100, lev: mk === "spot" ? 1 : lev, price, ...(useSL ? bracket(dir) : {}) });
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-5">
        <div className={card}>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div><div className="text-[14px] text-[var(--muted)]">{tt.equity}</div><div dir="ltr" className="font-mono text-[30px] font-semibold text-[var(--ink)]">{money(lang, eq)}</div></div>
            <div><div className="text-[14px] text-[var(--muted)]">{tt.pnlStart}</div><div dir="ltr" className="font-mono text-[18px]" style={{ color: sgn(pl) }}>{pl >= 0 ? "+" : ""}{money(lang, pl)} · {pct(lang, pl / a.start, 1)}</div></div>
            <div><div className="text-[14px] text-[var(--muted)]">{tt.cash}</div><div dir="ltr" className="font-mono text-[18px] text-[var(--ink)]">{money(lang, a.cash)}</div></div>
            <div><div className="text-[14px] text-[var(--muted)]">{tt.startBal}</div><div dir="ltr" className="font-mono text-[18px] text-[var(--muted)]">{money(lang, a.start, 0)}</div></div>
          </div>
          <div className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
            <div><Label>{t.spot} / {t.futures}</Label><Seg val={mk} on={setMk} opts={[["spot", t.spot], ["futures", t.futures]]} /></div>
            {mk === "futures" && <div><Label>{tt.leverage} · <span className="font-mono">{lev}×</span></Label><input type="range" min={1} max={50} value={lev} onChange={(e) => setLev(+e.target.value)} className="leon-range w-full" /></div>}
            <div><Label>{tt.size} · <span className="font-mono">{size}%</span> ≈ <span dir="ltr" className="font-mono">{money(lang, (eq * size) / 100)}</span></Label><input type="range" min={1} max={100} value={size} onChange={(e) => setSize(+e.target.value)} className="leon-range w-full" /></div>
            <label className="flex items-center gap-2 self-end text-[14px] text-[var(--muted)]"><input type="checkbox" checked={useSL} onChange={(e) => setUseSL(e.target.checked)} className="leon-range h-4 w-4" />{tt.useStratSL}</label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn tone="long" onClick={() => go(1)}>{mk === "spot" ? t.kinds.buy : t.fut.openLong} <span dir="ltr" className="font-mono">{sym}</span></Btn>
            {mk === "futures" && <Btn tone="short" onClick={() => go(-1)}>{t.fut.openShort} <span dir="ltr" className="font-mono">{sym}</span></Btn>}
            <span dir="ltr" className="ms-auto self-center font-mono text-[14px] text-[var(--muted)]">@ {fmtPrice(price)}</span>
          </div>
        </div>

        <div className={card}>
          <div className="mb-3 flex items-baseline justify-between"><h3 className="text-[18px] font-semibold text-[var(--ink)]">{tt.openPos}</h3><span className="text-[14px] text-[var(--muted)]">{num(lang, a.positions.length)}</span></div>
          {!a.positions.length ? <p className="text-[15px] text-[var(--muted)]">{tt.noOpen}</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[14px]"><thead><tr className="text-[var(--muted)]">{[t.side, tt.coin, t.entry, t.stop, t.target, tt.liq, t.upnl, ""].map((h, k) => <th key={k} className="py-2 text-start font-normal">{h}</th>)}</tr></thead>
              <tbody>{a.positions.map((p) => { const cur = p.sym === sym ? price : p.last; const u = upnl(p, cur); return (
                <tr key={p.id} className="border-t border-[var(--line)]">
                  <td className="py-2.5"><span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: p.dir === 1 ? "var(--long)" : "var(--short)", color: p.dir === 1 ? "#0b1128" : "#fff" }}>{p.market === "spot" ? t.spot : `${p.dir === 1 ? t.longS : t.shortS} ${p.lev}×`}</span></td>
                  <td dir="ltr" className="py-2.5 font-mono text-[var(--ink)]">{p.sym}</td>
                  <td dir="ltr" className="py-2.5 font-mono">{fmtPrice(p.entry)}</td>
                  <td dir="ltr" className="py-2.5 font-mono text-[var(--short)]">{p.sl ? fmtPrice(p.sl) : "—"}{p.be ? " BE" : ""}</td>
                  <td dir="ltr" className="py-2.5 font-mono text-[var(--long)]">{p.tp ? fmtPrice(p.tp) : "—"}</td>
                  <td dir="ltr" className="py-2.5 font-mono text-[var(--muted)]">{liqPrice(p) > 0 ? fmtPrice(liqPrice(p)) : "—"}</td>
                  <td dir="ltr" className="py-2.5 font-mono" style={{ color: sgn(u) }}>{u >= 0 ? "+" : ""}{money(lang, u)} ({pct(lang, u / p.margin, 1)})</td>
                  <td className="py-2.5 text-end"><Btn className="h-8 px-3" onClick={() => tr.paperCloseManual(p.id, cur)}>{tt.close}</Btn></td>
                </tr>); })}</tbody></table></div>
          )}
          {a.history.length > 0 && <div className="mt-4 border-t border-[var(--line)] pt-3"><Label>{tt.recent}</Label>
            <div className="flex flex-col gap-1.5">{a.history.slice(0, 6).map((h) => <div key={h.id + h.closed} dir="ltr" className="flex flex-wrap justify-between gap-2 font-mono text-[13px] text-[var(--muted)]"><span>{h.dir === 1 ? "▲" : "▼"} {h.sym} {fmtPrice(h.entry)} → {fmtPrice(h.exit)} · {t.res[h.why] || (h.why === "liq" ? "LIQ" : h.why.toUpperCase())}</span><span style={{ color: sgn(h.pnl) }}>{h.pnl >= 0 ? "+" : ""}{money(lang, h.pnl)}</span></div>)}</div></div>}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className={card}>
          <h3 className="text-[18px] font-semibold text-[var(--ink)]">{tt.newAcct}</h3>
          <p className="mt-1 text-[14px] text-[var(--muted)]">{tt.newAcctHint}</p>
          <div className="mt-3"><Label>{tt.startBal} (USDT)</Label>
            <div className="mb-2 flex flex-wrap gap-1.5">{[100, 500, 1000, 10000, 100000].map((v) => <button key={v} type="button" onClick={() => setStart(v)} className={`h-8 rounded-full px-3 font-mono text-[13px] ${+start === v ? "bg-[var(--brass)] text-[var(--onb)]" : "border border-[var(--line)] text-[var(--muted)]"}`}>${v.toLocaleString("en-US")}</button>)}</div>
            <input dir="ltr" type="number" min={10} value={start} onChange={(e) => setStart(e.target.value)} className={input} aria-label={tt.startBal} />
          </div>
          <div className="mt-3"><Label>{tt.fee} (%)</Label><input dir="ltr" type="number" step="0.01" min={0} value={fee} onChange={(e) => setFee(e.target.value)} className={input} /></div>
          {!confirmReset ? <Btn tone="brass" className="mt-4 w-full" disabled={!(+start >= 10)} onClick={() => setConfirmReset(true)}>{tt.startNew}</Btn> : (
            <div className="mt-4 rounded-xl bg-[var(--hover)] p-3 text-[14px] text-[var(--ink)]">{tt.resetWarn}<div className="mt-2 flex gap-2"><Btn tone="brass" onClick={() => { tr.resetPaper(+start, +fee); setConfirmReset(false); }}>{tt.yesReset}</Btn><Btn onClick={() => setConfirmReset(false)}>{tt.cancel}</Btn></div></div>
          )}
        </div>

        <div className={card}>
          <h3 className="text-[18px] font-semibold text-[var(--ink)]">{tt.stratTest}</h3>
          <p className="mt-1 text-[14px] text-[var(--muted)]">{tt.stratTestHint.replace("{b}", money(lang, a.start, 0))}</p>
          <div className="mt-3 grid gap-3">
            <div><Label>{t.spot} / {t.futures}</Label><Seg val={simO.market} on={(v) => setSimO((s) => ({ ...s, market: v }))} opts={[["spot", t.spot], ["futures", t.futures]]} /></div>
            <div><Label>{tt.size} · <span className="font-mono">{simO.sizePct}%</span></Label><input type="range" min={1} max={100} value={simO.sizePct} onChange={(e) => setSimO((s) => ({ ...s, sizePct: +e.target.value }))} className="leon-range w-full" /></div>
            {simO.market === "futures" && <div><Label>{tt.leverage} · <span className="font-mono">{simO.lev}×</span></Label><input type="range" min={1} max={50} value={simO.lev} onChange={(e) => setSimO((s) => ({ ...s, lev: +e.target.value }))} className="leon-range w-full" /></div>}
          </div>
          <div className="mt-4 rounded-xl bg-[var(--hover)] p-3">
            <div className="flex items-baseline justify-between text-[14px]"><span className="font-semibold text-[var(--brass)]">{t.s[sel.s.id][0]}</span><span className="text-[var(--muted)]">{num(lang, sim.n)} {t.trades}</span></div>
            <div dir="ltr" className="mt-1 font-mono text-[24px]" style={{ color: sgn(sim.ret) }}>{money(lang, sim.final)}</div>
            <Spark curve={sim.curve} />
            <div className="mt-1 grid grid-cols-3 gap-2 text-[13px]"><div><div className="text-[var(--muted)]">{t.ret}</div><div dir="ltr" className="font-mono" style={{ color: sgn(sim.ret) }}>{pct(lang, sim.ret, 1)}</div></div><div><div className="text-[var(--muted)]">{tt.maxDD}</div><div dir="ltr" className="font-mono text-[var(--short)]">{pct(lang, sim.maxDD, 1)}</div></div><div><div className="text-[var(--muted)]">{tt.liqs}</div><div className="font-mono text-[var(--ink)]">{num(lang, sim.liq)}</div></div></div>
          </div>
          <div className="mt-3"><Label>{tt.allStrats} · {t.modes[mode]}</Label>
            <div className="flex flex-col gap-1">{all.map((r, k) => <div key={r.id} className="flex items-center justify-between gap-2 text-[14px]"><span className="truncate text-[var(--ink)]">{num(lang, k + 1)}. {t.s[r.id][0]}</span><span dir="ltr" className="font-mono" style={{ color: sgn(r.ret) }}>{money(lang, r.final, 0)}</span></div>)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ exchanges (real accounts)
function ExchangesTab({ tr, tt, t, lang, sym, price }) {
  const [pin, setPin] = useState(""); const [pin2, setPin2] = useState(""); const [err, setErr] = useState(""); const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({}); const [test, setTest] = useState({}); const [busy, setBusy] = useState(false);
  const [mo, setMo] = useState({ acct: "", market: "futures", lev: 3, margin: 20 }); const [ask, setAsk] = useState(null);
  const unlocked = !!tr.creds; const connected = EXCHANGES.filter((e) => tr.creds?.[e.id]);
  const doUnlock = async () => { setErr(""); setBusy(true); try { if (!tr.hasVault) { if (pin.length < 6) throw new Error("pinShort"); if (pin !== pin2) throw new Error("pinMatch"); await tr.saveCred(pin, "_init", { at: Date.now() }); } else await tr.unlock(pin); setPin(""); setPin2(""); } catch (e) { setErr(errText(tt, e.message)); } setBusy(false); };
  const save = async (ex) => { setBusy(true); setErr(""); try { const c = { key: form.key?.trim(), secret: form.secret?.trim(), pass: form.pass?.trim(), testnet: !!form.testnet }; if (!c.key || !c.secret || (ex.pass && !c.pass)) throw new Error("missing"); const r = await tr.testCred(ex.id, c); setTest((s) => ({ ...s, [ex.id]: r })); await tr.saveCred(tr.creds._pin, ex.id, c); setEdit(null); setForm({}); } catch (e) { setErr(errText(tt, e.message)); } setBusy(false); };
  const recheck = async (id) => { setTest((s) => ({ ...s, [id]: "…" })); const r = await tr.testCred(id, tr.creds[id]); setTest((s) => ({ ...s, [id]: r })); };
  const acct = mo.acct || connected[0]?.id; const exA = exchange(acct);
  const place = async () => { setBusy(true); setErr(""); try { await tr.liveManual({ acct, sym, market: mo.market, dir: ask.dir, margin: +mo.margin, lev: +mo.lev, price }); } catch (e) { setErr(errText(tt, e.message)); } setAsk(null); setBusy(false); };

  if (!unlocked) return (
    <div className={`${card} max-w-[560px]`}>
      <div className="flex items-center gap-2 text-[18px] font-semibold text-[var(--ink)]"><KeyRound size={20} className="text-[var(--brass)]" />{tr.hasVault ? tt.unlockTitle : tt.createPin}</div>
      <p className="mt-2 text-[14px] text-[var(--muted)]">{tr.hasVault ? tt.unlockHint : tt.createPinHint}</p>
      <div className="mt-4 grid gap-3">
        <input type="password" inputMode="numeric" autoComplete="off" placeholder={tt.pin} value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doUnlock()} className={input} />
        {!tr.hasVault && <input type="password" inputMode="numeric" autoComplete="off" placeholder={tt.pinAgain} value={pin2} onChange={(e) => setPin2(e.target.value)} className={input} />}
        {err && <div className="text-[14px] text-[var(--short)]">{err}</div>}
        <Btn tone="brass" disabled={busy || !pin} onClick={doUnlock}><Unlock size={16} />{tr.hasVault ? tt.unlock : tt.createPinBtn}</Btn>
        {tr.hasVault && <button type="button" onClick={() => { if (window.confirm(tt.forgotConfirm)) tr.wipe(); }} className="text-[13px] text-[var(--muted)] underline">{tt.forgot}</button>}
      </div>
      {!canTradeLive && <p className="mt-4 rounded-xl bg-[var(--hover)] p-3 text-[14px] text-[var(--saffron)]">{tt.webNote}</p>}
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="rounded-2xl border border-[var(--short)] bg-[#ff72470f] p-4 text-[14px] text-[var(--ink)]"><div className="mb-1 flex items-center gap-2 font-semibold text-[var(--short)]"><ShieldAlert size={18} />{tt.realMoney}</div>{tt.keyTips}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          {EXCHANGES.map((ex) => { const c = tr.creds[ex.id]; const r = test[ex.id]; return (
            <div key={ex.id} className={card}>
              <div className="flex items-center justify-between"><div className="text-[18px] font-semibold text-[var(--ink)]">{ex.name}</div>{c ? <span className="flex items-center gap-1.5 text-[13px] text-[var(--long)]"><span className="h-2 w-2 rounded-full bg-[var(--long)]" />{c.testnet ? tt.testnet : tt.connected}</span> : <span className="text-[13px] text-[var(--muted)]">{tt.notConnected}</span>}</div>
              <div className="mt-1 text-[13px] text-[var(--muted)]">{t.spot} · {t.futures}{NATIVE_SLTP.includes(ex.id) ? ` · ${tt.nativeSLTP}` : ""}{ex.testnet ? ` · ${tt.hasTestnet}` : ""}</div>
              {r && r !== "…" && <div dir="ltr" className="mt-2 flex flex-wrap gap-3 font-mono text-[13px]">{Object.entries(r).map(([m, v]) => <span key={m} style={{ color: typeof v === "number" ? "var(--ink)" : "var(--short)" }}>{m}: {typeof v === "number" ? `${v.toFixed(2)} USDT` : v.error}</span>)}</div>}
              {r === "…" && <div className="mt-2 text-[13px] text-[var(--muted)]">…</div>}
              {edit === ex.id ? (
                <div className="mt-3 grid gap-2">
                  <input dir="ltr" placeholder="API key" autoComplete="off" value={form.key || ""} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} className={input} />
                  <input dir="ltr" type="password" placeholder="API secret" autoComplete="off" value={form.secret || ""} onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))} className={input} />
                  {ex.pass && <input dir="ltr" type="password" placeholder="Passphrase" autoComplete="off" value={form.pass || ""} onChange={(e) => setForm((f) => ({ ...f, pass: e.target.value }))} className={input} />}
                  {ex.testnet && <label className="flex items-center gap-2 text-[14px] text-[var(--muted)]"><input type="checkbox" checked={!!form.testnet} onChange={(e) => setForm((f) => ({ ...f, testnet: e.target.checked }))} />{tt.useTestnet}</label>}
                  {err && <div className="text-[13px] text-[var(--short)]">{err}</div>}
                  <div className="flex gap-2"><Btn tone="brass" disabled={busy} onClick={() => save(ex)}>{busy ? "…" : tt.saveTest}</Btn><Btn onClick={() => { setEdit(null); setErr(""); }}>{tt.cancel}</Btn></div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn tone={c ? "line" : "brass"} onClick={() => { setEdit(ex.id); setForm(c ? { ...c } : {}); setErr(""); }}><Link2 size={16} />{c ? tt.edit : tt.connect}</Btn>
                  {c && <Btn onClick={() => recheck(ex.id)}>{tt.check}</Btn>}
                  {c && <Btn tone="danger" onClick={() => tr.removeCred(ex.id)}><Trash2 size={16} /></Btn>}
                </div>
              )}
            </div>); })}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className={card}>
          <h3 className="text-[18px] font-semibold text-[var(--ink)]">{tt.manualTitle}</h3>
          {!connected.length ? <p className="mt-2 text-[14px] text-[var(--muted)]">{tt.connectFirst}</p> : (<>
            <div className="mt-3 grid gap-3">
              <div><Label>{tt.exchange}</Label><Seg val={acct} on={(v) => setMo((s) => ({ ...s, acct: v }))} opts={connected.map((e) => [e.id, e.name])} /></div>
              <div><Label>{t.spot} / {t.futures}</Label><Seg val={mo.market} on={(v) => setMo((s) => ({ ...s, market: v }))} opts={exA.markets.map((m) => [m, m === "spot" ? t.spot : t.futures])} /></div>
              {mo.market === "futures" && <div><Label>{tt.leverage} · <span className="font-mono">{mo.lev}×</span></Label><input type="range" min={1} max={20} value={mo.lev} onChange={(e) => setMo((s) => ({ ...s, lev: +e.target.value }))} className="leon-range w-full" /></div>}
              <div><Label>{tt.marginUsdt}</Label><input dir="ltr" type="number" min={1} value={mo.margin} onChange={(e) => setMo((s) => ({ ...s, margin: e.target.value }))} className={input} /></div>
            </div>
            {ask ? (
              <div className="mt-4 rounded-xl border border-[var(--short)] p-3 text-[14px] text-[var(--ink)]">{tt.confirmReal.replace("{x}", `${ask.label} ${sym}/USDT · ${money(lang, Math.min(+mo.margin, +tr.risk.maxMargin || +mo.margin))}${mo.market === "futures" ? ` × ${mo.lev}` : ""} · ${exA.name}`)}
                <div className="mt-2 flex gap-2"><Btn tone={ask.dir === 1 ? "long" : "short"} disabled={busy} onClick={place}>{busy ? "…" : tt.yesPlace}</Btn><Btn onClick={() => setAsk(null)}>{tt.cancel}</Btn></div></div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Btn tone="long" onClick={() => setAsk({ dir: 1, label: mo.market === "spot" ? t.kinds.buy : t.fut.openLong })}>{mo.market === "spot" ? t.kinds.buy : t.fut.openLong}</Btn>
                {mo.market === "futures" && <Btn tone="short" onClick={() => setAsk({ dir: -1, label: t.fut.openShort })}>{t.fut.openShort}</Btn>}
              </div>
            )}
            {err && <div className="mt-2 text-[13px] text-[var(--short)]">{err}</div>}
            {tr.manual.length > 0 && <div className="mt-4 flex flex-col gap-2 border-t border-[var(--line)] pt-3">{tr.manual.map((p) => { const u = p.sym === sym ? upnl(p, price) : null; return (
              <div key={p.id} className="flex items-center justify-between gap-2 text-[14px]"><span dir="ltr" className="font-mono text-[var(--ink)]">{p.dir === 1 ? "▲" : "▼"} {p.sym} {p.market === "futures" ? `${p.lev}×` : ""} @ {fmtPrice(p.entry)} · {exchange(p.acct)?.name}</span>
                {u != null && <span dir="ltr" className="font-mono" style={{ color: sgn(u) }}>{money(lang, u)}</span>}
                <Btn className="h-8 px-3" disabled={p.sym !== sym} title={p.sym !== sym ? tt.openCoin : ""} onClick={() => tr.liveManualClose(p.id, price).catch((e) => setErr(errText(tt, e.message)))}>{tt.close}</Btn></div>); })}</div>}
          </>)}
        </div>

        <div className={card}>
          <h3 className="text-[18px] font-semibold text-[var(--ink)]">{tt.safety}</h3>
          <div className="mt-3 grid gap-3">
            <div><Label>{tt.maxMargin}</Label><input dir="ltr" type="number" min={1} value={tr.risk.maxMargin} onChange={(e) => tr.setRisk((r) => ({ ...r, maxMargin: +e.target.value }))} className={input} /></div>
            <div><Label>{tt.dailyLoss}</Label><input dir="ltr" type="number" min={0} value={tr.risk.dailyLoss} onChange={(e) => tr.setRisk((r) => ({ ...r, dailyLoss: +e.target.value }))} className={input} /></div>
            <label className="flex items-center gap-2 text-[14px] text-[var(--ink)]"><input type="checkbox" checked={tr.risk.confirm} onChange={(e) => tr.setRisk((r) => ({ ...r, confirm: e.target.checked }))} />{tt.confirmDefault}</label>
            <div className="text-[13px] text-[var(--muted)]">{tt.todayPnl}: <span dir="ltr" className="font-mono" style={{ color: sgn(tr.day.pnl) }}>{money(lang, tr.day.pnl)}</span></div>
            <Btn onClick={tr.lock}><Lock size={16} />{tt.lock}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ exchanges, preview-only view (no key entry in the web preview)
function ExchangesPreview({ tt, t }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-2xl border border-[var(--saffron)] bg-[#e9a00e12] p-4 text-[14px] text-[var(--ink)]"><KeyRound size={18} className="mt-0.5 shrink-0 text-[var(--saffron)]" /><span>{tt.previewEx}</span></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {EXCHANGES.map((ex) => (
          <div key={ex.id} className={card}>
            <div className="flex items-center justify-between"><div className="text-[18px] font-semibold text-[var(--ink)]">{ex.name}</div><span className="text-[13px] text-[var(--muted)]">{tt.notConnected}</span></div>
            <div className="mt-1 text-[13px] text-[var(--muted)]">{t.spot} · {t.futures}{NATIVE_SLTP.includes(ex.id) ? ` · ${tt.nativeSLTP}` : ""}{ex.testnet ? ` · ${tt.hasTestnet}` : ""}</div>
            <div className="mt-3 flex flex-wrap gap-2"><Btn tone="brass" disabled title={tt.previewEx}><Link2 size={16} />{tt.connect}</Btn></div>
          </div>))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ bots
function BotsTab({ tr, tt, t, lang, sym, tf, price, sel, mode, o }) {
  const connected = EXCHANGES.filter((e) => tr.creds?.[e.id]);
  const [f, setF] = useState({ account: "paper", market: "futures", sizeMode: "pct", size: 10, lev: 3 });
  const [ok, setOk] = useState(false);
  const live = f.account !== "paper"; const exA = exchange(f.account);
  const start = () => { tr.addBot({ sym, tf, strat: sel.s.id, mode, rr: o.rr, strict: o.strict, goal: o.goal, ...(sel.s.members ? { members: sel.s.members } : {}), ...f, market: exA && !exA.markets.includes(f.market) ? "spot" : f.market, ...(live ? { confirm: tr.risk.confirm } : {}) }); setOk(false); };
  const stat = (b) => (b.on ? (b.status === "error" ? tt.st.error : b.status === "noData" ? tt.st.noData : b.account !== "paper" && !tr.creds?.[b.account] ? tt.st.locked : tt.st.watching) : tt.st.stopped);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[18px] font-semibold text-[var(--ink)]">{tt.yourBots}</h3>{tr.bots.length > 0 && <Btn tone="danger" onClick={tr.stopAll}><OctagonX size={16} />{tt.stopAll}</Btn>}</div>
        {!tr.bots.length && <div className={`${card} text-[15px] text-[var(--muted)]`}>{tt.noBots}</div>}
        {tr.bots.map((b) => { const isLive = b.account !== "paper"; const ex = exchange(b.account); const p = b.pos; const cur = b.sym === sym ? price : b.price; const u = p && cur ? p.dir * p.qty * (cur - p.entry) : null; return (
          <div key={b.id} className={`${card} ${isLive && b.on ? "border-[var(--short)]" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${b.on ? "leon-pulse bg-[var(--long)]" : "bg-[var(--line)]"}`} />
              <span className="font-semibold text-[var(--ink)]">{t.s[b.strat]?.[0] || b.strat}</span>
              <span dir="ltr" className="font-mono text-[14px] text-[var(--muted)]">{b.sym}/USDT · {b.tf}</span>
              <span className="text-[14px] text-[var(--muted)]">· {ex ? ex.name : tt.paper} · {b.market === "spot" ? t.spot : `${t.futures} ${b.lev}×`}</span>
              <Badge live={isLive} tt={tt} />
              <div className="ms-auto flex gap-1.5">
                <Btn className="h-9 px-3" onClick={() => tr.toggleBot(b.id)} title={b.on ? tt.pause : tt.resumeBot}>{b.on ? <Pause size={16} /> : <Play size={16} />}</Btn>
                <Btn tone="danger" className="h-9 px-3" onClick={() => { if (!p || window.confirm(tt.removeConfirm)) tr.removeBot(b.id, cur); }}><Trash2 size={16} /></Btn>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-[var(--muted)]">
              <span>{stat(b)}{b.status === "error" && b.error ? `: ${errText(tt, b.error)}` : ""}</span>
              <span>{tt.sizing}: <span dir="ltr" className="font-mono">{b.sizeMode === "pct" ? `${b.size}%` : `$${b.size}`}</span></span>
              <span>{b.confirm ? tt.asksFirst : tt.fullAuto}</span>
              {b.checked && <span>{tt.checked} {new Date(b.checked).toLocaleTimeString(lang === "fa" ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
            </div>
            {p && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-[var(--hover)] px-3.5 py-2.5 text-[14px]">
              <b style={{ color: p.dir === 1 ? "var(--long)" : "var(--short)" }}>{p.dir === 1 ? t.longS : t.shortS}</b>
              <span dir="ltr" className="font-mono text-[var(--ink)]">{fmtPrice(p.entry)}</span>
              <span dir="ltr" className="font-mono text-[var(--short)]">SL {fmtPrice(p.sl)}{p.be ? " (BE)" : ""}</span>
              <span dir="ltr" className="font-mono text-[var(--long)]">TP {fmtPrice(p.tp)}</span>
              {isLive && <span className="text-[13px]">{p.nativeSLTP ? tt.onExchange : tt.byLeon}</span>}
              {u != null && <span dir="ltr" className="font-mono" style={{ color: sgn(u) }}>{u >= 0 ? "+" : ""}{money(lang, u)}</span>}
              <Btn className="ms-auto h-8 px-3" disabled={!cur} onClick={() => tr.closeBotPos(b.id, cur)}>{tt.closeNow}</Btn>
            </div>}
          </div>); })}
      </div>

      <div className={card}>
        <h3 className="text-[18px] font-semibold text-[var(--ink)]">{tt.newBot}</h3>
        <p className="mt-1 text-[14px] text-[var(--muted)]">{tt.newBotHint}</p>
        <div className="mt-3 rounded-xl bg-[var(--hover)] px-3.5 py-2.5 text-[14px]"><span className="font-semibold text-[var(--brass)]">{t.s[sel.s.id][0]}</span> <span dir="ltr" className="font-mono text-[var(--ink)]">· {sym}/USDT · {tf}</span><div className="text-[13px] text-[var(--muted)]">{t.oosShort} {pct(lang, sel.bt.oos.winRate)} · {t.pf} {num(lang, sel.bt.pf, { maximumFractionDigits: 2 })}</div></div>
        <div className="mt-3 grid gap-3">
          <div><Label>{tt.account}</Label><Seg val={f.account} on={(v) => setF((s) => ({ ...s, account: v }))} opts={[["paper", tt.paper], ...connected.map((e) => [e.id, e.name])]} />{!tr.creds && <div className="mt-1.5 text-[13px] text-[var(--muted)]">{tt.unlockForLive}</div>}</div>
          <div><Label>{t.spot} / {t.futures}</Label><Seg val={f.market} on={(v) => setF((s) => ({ ...s, market: v }))} opts={[["spot", t.spot], ["futures", t.futures]]} /></div>
          {f.market === "futures" && <div><Label>{tt.leverage} · <span className="font-mono">{f.lev}×</span></Label><input type="range" min={1} max={live ? 20 : 50} value={f.lev} onChange={(e) => setF((s) => ({ ...s, lev: +e.target.value }))} className="leon-range w-full" /></div>}
          <div><Label>{tt.sizing}</Label><Seg val={f.sizeMode} on={(v) => setF((s) => ({ ...s, sizeMode: v }))} opts={[["pct", tt.pctBal], ["usdt", tt.fixedUsdt]]} />
            <input dir="ltr" type="number" min={1} value={f.size} onChange={(e) => setF((s) => ({ ...s, size: +e.target.value }))} className={`${input} mt-2`} /></div>
          {live && <div className="rounded-xl border border-[var(--short)] p-3 text-[13px] text-[var(--ink)]">{tt.liveBotWarn.replace("{m}", money(lang, tr.risk.maxMargin, 0))}</div>}
          {live && !ok ? <Btn tone="short" onClick={() => setOk(true)}><Bot size={16} />{tt.armLive}</Btn> : live ? (
            <div className="flex gap-2"><Btn tone="short" onClick={start}>{tt.yesArm}</Btn><Btn onClick={() => setOk(false)}>{tt.cancel}</Btn></div>
          ) : <Btn tone="brass" onClick={start}><Bot size={16} />{tt.startBot}</Btn>}
          <p className="text-[13px] text-[var(--muted)]">{tt.botRules}</p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ activity
function ActivityTab({ tr, tt, t, lang }) {
  const name = (a) => (a === "paper" ? tt.paper : a === "live" ? tt.liveB : exchange(a)?.name || "");
  const line = (e) => {
    const side = e.dir === 1 ? t.longS : t.shortS;
    if (e.kind === "open") return `${tt.ev.open} ${side} ${e.sym}${e.usdt ? ` · ${money(lang, e.usdt)}` : ""}${e.lev > 1 ? ` × ${e.lev}` : ""} @ ${fmtPrice(e.price)}`;
    if (e.kind === "close") return `${tt.ev.close} ${side} ${e.sym} @ ${fmtPrice(e.price)} · ${tt.why[e.why] || e.why} · ${e.pnl >= 0 ? "+" : ""}${money(lang, e.pnl)}`;
    if (e.kind === "pending") return `${tt.ev.pending} ${side} ${e.sym} @ ${fmtPrice(e.price)}`;
    if (e.kind === "error") return `${tt.ev.error} ${e.sym || ""}: ${errText(tt, e.text)}`;
    if (e.kind === "pause") return `${tt.ev.pause} ${money(lang, e.pnl)}`;
    if (e.kind === "reset") return `${tt.ev.reset} ${money(lang, e.amount, 0)}`;
    if (e.kind === "stopAll") return tt.ev.stopAll;
    return e.kind;
  };
  return (
    <div className={card}>
      <div className="mb-3 flex items-center justify-between"><h3 className="text-[18px] font-semibold text-[var(--ink)]">{tt.activity}</h3>{tr.log.length > 0 && <Btn className="h-8 px-3" onClick={tr.clearLog}>{tt.clear}</Btn>}</div>
      {!tr.log.length ? <p className="text-[15px] text-[var(--muted)]">{tt.noActivity}</p> : (
        <div className="flex max-h-[420px] flex-col overflow-auto">{tr.log.map((e) => (
          <div key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-[var(--line)] py-2 text-[14px] first:border-0">
            <span className="w-[86px] shrink-0 font-mono text-[12px] text-[var(--muted)]">{new Date(e.t).toLocaleTimeString(lang === "fa" ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            {e.acct && <Badge live={e.acct !== "paper"} tt={tt} />}
            {e.acct && <span className="text-[var(--muted)]">{name(e.acct)}</span>}
            <span className="text-[var(--ink)]" style={{ color: e.kind === "error" ? "var(--short)" : e.kind === "close" ? sgn(e.pnl) : undefined }}>{line(e)}</span>
          </div>))}</div>
      )}
    </div>
  );
}

export default function TradeDesk(props) {
  const { tt, tr } = props; const [tab, setTab] = useState("paper");
  const armed = tr.bots.filter((b) => b.on).length;
  const tabs = [["paper", FlaskConical, tt.tabs.paper], ["live", Link2, tt.tabs.live], ["bots", Bot, tt.tabs.bots + (armed ? ` · ${num(props.lang, armed)}` : "")], ["log", ScrollText, tt.tabs.log]];
  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-[22px] font-semibold text-[var(--ink)]">{tt.desk}</h2>
        <div className="flex flex-wrap gap-1.5 rounded-[18px] bg-[var(--panel)] p-1.5 sm:ms-auto">
          {tabs.map(([k, I, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`flex h-10 items-center gap-2 rounded-[13px] px-3.5 text-[14px] font-semibold transition ${tab === k ? "bg-[var(--saffron)] text-[#0b1128]" : "text-[var(--ink)] hover:bg-[var(--hover)]"}`}><I size={16} />{l}</button>)}
        </div>
      </div>
      {tab === "paper" && <PaperTab {...props} />}
      {tab === "live" && (PREVIEW ? <ExchangesPreview {...props} /> : <ExchangesTab {...props} />)}
      {tab === "bots" && <BotsTab {...props} />}
      {tab === "log" && <ActivityTab {...props} />}
    </section>
  );
}
