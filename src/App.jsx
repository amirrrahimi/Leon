/* LEON — bilingual (EN/FA) crypto chart analyst.
   Subject: a trader's signal desk that reads live candles, ranks strategies by win rate per horizon
   (long / mid / scalp) and timeframe, and calls spot BUY/SELL + futures open/close long/short.
   Design: the Persian astrolabe. Night lapis ground, brass instrument lines, saffron highlights.
   Type: Outfit (display), Vazirmatn (Persian + UI), IBM Plex Mono (prices).
   Palette: lapis #0b1128 · panel #121a3c · brass #c9a24a · saffron #e9a00e · long #9cc23f · short #ef5a2c · parchment #ece3cc
   Layout: header(search, lang) / horizon + timeframe / [chart | astrolabe win-rate dial + call] / ranked strategy ledger with per-timeframe win rates
   Signature: the astrolabe dial whose needle swings with the selected strategy's live win rate.
   1.3.0: signal sound alerts (desktop + phone), >= 50 recent buy/sell points per strategy (deeper history),
          10 more strategies (20 total), every strategy tagged with the trading style it suits best. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Settings2, Sun, Moon, X } from "lucide-react";
import Settings, { DEFAULTS } from "./Settings";
import TradeLog from "./TradeLog";
import { COINS, MODES, coinInfo, fmtPrice } from "./lib/market";
import { useMarket, loadHistory, LIVE, PAGE, MAX_DEPTH } from "./lib/feed";
import { STRATS, FITS, MIN_POINTS, backtest, callFor, makeElite } from "./lib/strategies";
import { makeWatcher, beep, vibrate, notify, unlock } from "./lib/alerts";
import AlertBell from "./AlertBell";
import Points from "./Points";
import StrategyGuide from "./StrategyGuide";
import { T, num, pct } from "./lib/i18n";
import Chart from "./Chart";
import Dial from "./Dial";
import TradeDesk, { PendingBar } from "./Trade";
import useTrading from "./useTrading";
import { TT } from "./lib/i18n-trade";
import "./leon.css";

// Deep histories are heavy: refresh the analysis at most every `ms` milliseconds (signals only change on closed candles anyway)
function useThrottled(v, ms) {
  const [s, setS] = useState(v); const last = useRef(0); const key = useRef(v.key);
  useEffect(() => {
    const now = Date.now(); const wait = last.current + ms - now;
    if (!ms || wait <= 0 || v.key !== key.current || v.length !== s.length) { last.current = now; key.current = v.key; setS(v); return; }
    const id = setTimeout(() => { last.current = Date.now(); setS(v); }, wait); return () => clearTimeout(id);
  }, [v, ms]);
  return s;
}

const tfLabel = (lang, tf) => (lang === "fa" ? tf.replace(/\d+/, (d) => Number(d).toLocaleString("fa-IR")).replace("m", " دقیقه").replace("h", " ساعت").replace("d", " روز").replace("w", " هفته") : tf);

function Logo() {
  return (
    <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden>
      {Array.from({ length: 16 }, (_, k) => { const a = (k * Math.PI) / 8; return <line key={k} x1={20 + 13 * Math.cos(a)} y1={20 + 13 * Math.sin(a)} x2={20 + (k % 2 ? 17 : 19) * Math.cos(a)} y2={20 + (k % 2 ? 17 : 19) * Math.sin(a)} stroke="#c9a24a" strokeWidth="1.6" strokeLinecap="round" />; })}
      <circle cx="20" cy="20" r="10.5" fill="#e9a00e" />
      <path d="M16 13.5 V26 H25" stroke="#0b1128" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CoinSearch({ sym, setSym, t, lang }) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const Q = q.trim().toUpperCase();
  const list = COINS.filter((c) => !Q || c.s.includes(Q) || c.n.toUpperCase().includes(Q));
  const pick = (s) => { setSym(s); setQ(""); setOpen(false); };
  return (
    <div className="relative w-full max-w-[340px]">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter" && Q) pick(list[0]?.s === Q || !list.length ? Q : list[0].s); }}
        placeholder={t.search} aria-label={t.search}
        className="h-11 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-5 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--brass)]" />
      {open && (
        <div className="absolute z-30 mt-2 max-h-[340px] w-full overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-2xl">
          {Q && !COINS.some((c) => c.s === Q) && /^[A-Z0-9]{2,10}$/.test(Q) && (
            <button onMouseDown={() => pick(Q)} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start hover:bg-[var(--hover)]"><span className="font-semibold">{Q}<span className="ms-2 text-[var(--muted)]">USDT</span></span><span className="text-[14px] text-[var(--saffron)]">{t.addCustom} →</span></button>
          )}
          {list.map((c) => (
            <button key={c.s} onMouseDown={() => pick(c.s)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start hover:bg-[var(--hover)] ${c.s === sym ? "bg-[var(--hover)]" : ""}`}>
              <span><b className="font-semibold">{c.s}</b><span className="ms-2 text-[14px] text-[var(--muted)]">{c.n}</span></span>
              <span dir="ltr" className="font-mono text-[14px] text-[var(--muted)]">{fmtPrice(c.p)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState("en");
  const [mode, setMode] = useState("mid");
  const [tf, setTf] = useState(MODES.mid.def);
  const [sym, setSym] = useState("BTC");
  const [pick, setPick] = useState(null);
  const t = T[lang]; const tt = TT[lang];
  const tr = useTrading();
  const [o, setO] = useState(() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("leon-chart") || "{}") }; } catch { return DEFAULTS; } });
  const set = (k, v) => setO((p) => ({ ...p, [k]: typeof v === "function" ? v(p[k]) : v }));
  useEffect(() => { try { localStorage.setItem("leon-chart", JSON.stringify(o)); } catch {} }, [o]);
  const [showSet, setShowSet] = useState(false);

  const chooseMode = (m) => { setMode(m); setTf(MODES[m].def); setPick(null); };

  // history depth per coin+timeframe: grows until every strategy has found >= MIN_POINTS buy/sell points
  const [depthMap, setDepthMap] = useState({});
  const depth = depthMap[sym + "|" + tf] || PAGE;
  const raw = useMarket(sym, tf, depth);
  const bars = useThrottled(raw, raw.length > 3000 ? 1500 : 0);
  const [fitF, setFitF] = useState("all");
  const strats = STRATS.filter((s) => s.modes.includes(mode)).map((s) => (o.rr === "auto" ? s : { ...s, rr: +o.rr, fixedRR: true }));
  const bopts = { strict: o.strict, tune: true, goal: o.goal };
  // 1.4.0: rank by the out-of-sample (unseen) part of the history, then add "Leon Elite" built from the top 4
  const results = useMemo(() => {
    const base = strats.map((s) => ({ s, bt: backtest(bars, s, bopts) })).sort((a, b) => b.bt.rank - a.bt.rank);
    const pool = base.filter((r) => r.bt.proven).length >= 2 ? base.filter((r) => r.bt.proven) : base;
    const elite = makeElite(pool.slice(0, 4).map((r) => r.s), mode);
    const all = [...base, { s: o.rr === "auto" ? elite : { ...elite, rr: +o.rr, fixedRR: true }, bt: null }].map((r) => (r.bt ? r : { ...r, bt: backtest(bars, r.s, bopts) }));
    return all.map((r) => ({ ...r, call: callFor(r.bt, bars) })).sort((a, b) => b.bt.rank - a.bt.rank);
  }, [bars, mode, o.rr, o.strict, o.goal]);
  const ready = bars.key === sym + "|" + tf + "|" + depth;
  const minPts = Math.min(...results.map((r) => r.bt.points.length));
  const canDeepen = ready && minPts < MIN_POINTS && !bars.exhausted && depth < MAX_DEPTH;
  useEffect(() => { if (!canDeepen) return; const need = minPts ? Math.ceil((depth * MIN_POINTS * 1.2) / minPts / PAGE) * PAGE : MAX_DEPTH; setDepthMap((m) => ({ ...m, [sym + "|" + tf]: Math.min(MAX_DEPTH, Math.max(depth + PAGE, need)) })); }, [canDeepen, depth, minPts, sym, tf]);
  const deepening = !ready || canDeepen;

  // signal alerts: ring the moment a strategy finds a new point on the candle that just closed
  const watch = useRef(null); if (!watch.current) watch.current = makeWatcher();
  const [toasts, setToasts] = useState([]); const lastRing = useRef(0);
  useEffect(() => { const u = () => unlock(); window.addEventListener("pointerdown", u, { once: true }); window.addEventListener("keydown", u, { once: true }); return () => { window.removeEventListener("pointerdown", u); window.removeEventListener("keydown", u); }; }, []);
  // win rate of each strategy across every timeframe of this horizon (snapshot)
  const [matrix, setMatrix] = useState({});
  useEffect(() => { let on = true; Promise.all(MODES[mode].tfs.map((x) => loadHistory(sym, x, PAGE).then((b) => [x, b]).catch(() => [x, null]))).then((rows) => { if (!on) return; const m = {}; rows.forEach(([x, b]) => b && b.length > 80 && strats.forEach((s) => { { const q = backtest(b, s, bopts).oos; (m[s.id] ||= {})[x] = q.decided >= 8 ? q.winRate : null; } })); setMatrix(m); }); return () => { on = false; }; }, [sym, mode, o.rr, o.strict, o.goal]);

  const shownRes = o.provenOnly ? results.filter((r) => r.bt.proven || r.s.elite) : results;
  const sel = results.find((r) => r.s.id === pick) || shownRes[0] || results[0];
  useEffect(() => {
    if (!ready) return;
    const lastClosed = bars.length - 2;
    const items = results.filter((r) => r.bt.points[0] && r.bt.points[0].i >= lastClosed).map((r) => ({ id: r.s.id, pro: !!r.s.pro, proven: r.bt.proven || !!r.s.elite, t: r.bt.points[0].t, dir: r.bt.points[0].dir, px: r.bt.points[0].px }));
    const fresh = watch.current(bars.key, items).filter((x) => o.alertScope === "all" || (o.alertScope === "pro" ? x.pro : o.alertScope === "proven" ? x.proven : x.id === sel.s.id));
    if (!fresh.length) return;
    const kind = fresh[0].dir === 1 ? "buy" : "sell";
    if (o.alerts && Date.now() - lastRing.current > 2500) { lastRing.current = Date.now(); beep(kind, o); if (o.vib) vibrate(kind); }
    if (o.alerts && o.notifyBg) notify(`Leon · ${sym}/USDT ${tf}`, fresh.map((x) => `${x.dir === 1 ? "▲ " + t.buyP : "▼ " + t.sellP} · ${t.s[x.id][0]} · ${fmtPrice(x.px)}`).join("\n"));
    const id = Date.now() + Math.random();
    setToasts((q) => [{ id, sym, tf, items: fresh }, ...q].slice(0, 3));
    setTimeout(() => setToasts((q) => q.filter((x) => x.id !== id)), 9000);
  }, [results]);
  const prev = useRef({ id: null, wr: 0 }); const [delta, setDelta] = useState(0);
  useEffect(() => { if (prev.current.id === sel.s.id && Math.abs(sel.bt.winRate - prev.current.wr) > 1e-9) setDelta(Math.sign(sel.bt.winRate - prev.current.wr)); else if (prev.current.id !== sel.s.id) setDelta(0); prev.current = { id: sel.s.id, wr: sel.bt.winRate }; }, [sel.bt.winRate, sel.s.id]);

  const last = bars[bars.length - 1], first = bars[bars.length - 25];
  useEffect(() => { tr.markPaper(sym, last.c); }, [sym, last.c]); // test-account stops/targets follow the live price
  const liveArmed = tr.bots.some((b) => b.on && b.account !== "paper");
  const chg = last.c / first.c - 1;
  const cons = results.reduce((a, r) => { const k = r.call.kind; a[k === "buy" || k === "holdLong" ? "l" : k === "sell" || k === "holdShort" ? "s" : "f"]++; return a; }, { l: 0, s: 0, f: 0 });
  const call = sel.call;
  const callCol = { buy: "var(--long)", holdLong: "var(--long)", tpHit: "var(--long)", sell: "var(--short)", holdShort: "var(--short)", slHit: "var(--short)" }[call.kind] || "var(--muted)";
  const coin = coinInfo(sym);
  const sinceBars = sel.bt.live ? bars.length - 1 - sel.bt.live.entryI : 0;

  return (
    <div dir={t.dir} lang={lang} data-theme={o.theme} className={`leon min-h-screen ${lang === "fa" ? "font-[Vazirmatn]" : "font-[Outfit]"}`}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Vazirmatn:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" />
      <div className="leon-safe mx-auto max-w-[1360px] px-4 pb-14 pt-5 sm:px-7">
        <header className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <Logo />
            <div><div className="font-[Outfit] text-[26px] font-semibold leading-none tracking-[0.18em] text-[var(--ink)]">LEON</div><div className="mt-1 text-[14px] text-[var(--muted)]">{t.tagline}</div></div>
          </div>
          <div className="order-3 w-full sm:order-none sm:ms-auto sm:w-auto sm:flex-1 sm:flex sm:justify-end"><CoinSearch sym={sym} setSym={(s) => { setSym(s); }} t={t} lang={lang} /></div>
          {liveArmed && <span className="flex h-9 items-center gap-2 rounded-full bg-[var(--short)] px-3 text-[13px] font-bold text-white"><span className="leon-pulse h-2 w-2 rounded-full bg-white" />{tt.liveB}</span>}
          <AlertBell o={o} set={set} t={t} />
          <button onClick={() => set("theme", (x) => (x === "night" ? "day" : "night"))} aria-label={t.theme} title={o.theme === "night" ? t.day : t.night} className="ms-auto flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] text-[var(--brass)] transition hover:bg-[var(--hover)] sm:ms-0">{o.theme === "night" ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="flex rounded-full border border-[var(--line)] p-1" role="group" aria-label="Language">
            {["en", "fa"].map((l) => <button key={l} onClick={() => setLang(l)} className={`h-9 rounded-full px-4 text-[14px] font-semibold transition ${lang === l ? "bg-[var(--brass)] text-[var(--onb)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}>{l === "en" ? "English" : "فارسی"}</button>)}
          </div>
        </header>
        <PendingBar tr={tr} tt={tt} t={t} lang={lang} />
        <div className="pointer-events-none fixed inset-x-3 top-24 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:end-5 sm:w-[360px]" aria-live="polite">
          {toasts.map((q) => (
            <div key={q.id} className="leon-toast pointer-events-auto w-full overflow-hidden rounded-2xl border bg-[var(--panel)] shadow-2xl" style={{ borderColor: q.items[0].dir === 1 ? "var(--long)" : "var(--short)" }}>
              <div className="flex items-center justify-between px-4 pt-3 text-[14px]"><span className="font-semibold text-[var(--saffron)]">🔔 {t.newPoint}</span><span dir="ltr" className="font-mono text-[var(--muted)]">{q.sym}/USDT · {q.tf}</span></div>
              <div className="flex flex-col gap-1 px-4 pb-3 pt-2">{q.items.slice(0, 4).map((x) => (
                <button key={x.id} type="button" onClick={() => setPick(x.id)} className="flex items-center justify-between gap-3 text-start text-[15px]">
                  <span className="font-bold" style={{ color: x.dir === 1 ? "var(--long)" : "var(--short)" }}>{x.dir === 1 ? "▲ " + t.buyP : "▼ " + t.sellP}</span>
                  <span className="flex-1 truncate text-[var(--ink)]">{t.s[x.id][0]}</span>
                  <span dir="ltr" className="font-mono text-[14px] text-[var(--muted)]">{fmtPrice(x.px)}</span>
                </button>))}
                {q.items.length > 4 && <span className="text-[13px] text-[var(--muted)]">+{num(lang, q.items.length - 4)}</span>}
              </div>
            </div>))}
        </div>

        <section className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="flex gap-1.5 rounded-[18px] bg-[var(--panel)] p-1.5">
            {Object.keys(MODES).map((m) => (
              <button key={m} onClick={() => chooseMode(m)} className={`rounded-[13px] px-4 py-2 text-start transition sm:px-5 ${mode === m ? "bg-[var(--saffron)] text-[#0b1128]" : "text-[var(--ink)] hover:bg-[var(--hover)]"}`}>
                <div className="text-[15px] font-semibold">{t.modes[m]}</div>
                <div className={`text-[14px] ${mode === m ? "text-[#3a2a08]" : "text-[var(--muted)]"}`}>{t.modeHint[m]}</div>
              </button>
            ))}
          </div>
          <div>
            <div className="mb-2 text-[14px] text-[var(--muted)]">{t.timeframe}</div>
            <div className="flex gap-1.5">
              {MODES[mode].tfs.map((x) => <button key={x} onClick={() => setTf(x)} className={`h-10 min-w-[54px] rounded-full border px-3.5 text-[14px] transition ${lang === "fa" ? "" : "font-mono"} ${tf === x ? "border-[var(--brass)] bg-[#c9a24a26] text-[var(--brass)]" : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"}`}>{tfLabel(lang, x)}</button>)}
            </div>
          </div>
        </section>

        <main className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-5">
          <div className="min-w-0 rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="font-[Outfit] text-[30px] font-semibold leading-none tracking-tight text-[var(--ink)]" dir="ltr">{sym}<span className="text-[var(--muted)]">/USDT</span></h1>
              <span dir="ltr" className="font-mono text-[22px] font-medium text-[var(--ink)]">{fmtPrice(last.c)}</span>
              <span dir="ltr" className="font-mono text-[15px]" style={{ color: chg >= 0 ? "var(--long)" : "var(--short)" }}>{chg >= 0 ? "+" : ""}{(chg * 100).toFixed(2)}%</span>
              <span className="ms-auto flex items-center gap-2 text-[14px] text-[var(--muted)]"><span className="leon-pulse h-2 w-2 rounded-full bg-[var(--long)]" />{(bars.live ?? LIVE) ? t.live : t.demo}</span>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[14px]">
              <span className="text-[var(--muted)]">{t.strategy}:</span>
              <span className="font-semibold text-[var(--brass)]">{t.s[sel.s.id][0]}</span>
              <span className="text-[var(--muted)]">· {tfLabel(lang, tf)}</span>
              <button onClick={() => setShowSet((v) => !v)} aria-expanded={showSet} className={`ms-auto flex h-9 items-center gap-2 rounded-full border px-3.5 text-[14px] transition ${showSet ? "border-[var(--brass)] text-[var(--brass)]" : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"}`}>{showSet ? <X size={16} /> : <Settings2 size={16} />}{t.settings}</button>
            </div>
            {showSet && <Settings o={o} set={set} t={t} reset={() => setO((p) => ({ ...DEFAULTS, theme: p.theme }))} />}
            <Chart bars={bars} bt={sel.bt} lang={lang} t={t} o={o} setZoom={(f) => set("zoom", f)} />
          </div>
          <Points bt={sel.bt} bars={bars} t={t} lang={lang} o={o} set={set} deepening={deepening} exhausted={!!bars.exhausted} name={t.s[sel.s.id][0]} />
          <TradeLog bt={sel.bt} bars={bars} t={t} lang={lang} o={o} />
          </div>

          <aside className="flex flex-col gap-5">
            <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] px-4 pb-5 pt-4">
              <div className="flex items-center justify-between text-[14px] text-[var(--muted)]"><span>{t.oosWin}</span><span className="font-semibold text-[var(--brass)]">{t.s[sel.s.id][0]}</span></div>
              <Dial value={sel.bt.oos.winRate} label={[[sel.bt.oos.wins, 0], [sel.bt.oos.losses, 1], [sel.bt.oos.bes, 2]].map(([v, k]) => (lang === "fa" ? `${t.wl[k]} ${num(lang, v)}` : `${v} ${t.wl[k]}`)).join(" · ")} lang={lang} delta={delta} />
              <div className="-mt-6 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-[var(--hover)] py-2"><div className="text-[14px] text-[var(--muted)]">{t.pf}</div><div className="font-mono text-[17px] text-[var(--ink)]">{num(lang, sel.bt.pf, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</div></div>
                <div className="rounded-xl bg-[var(--hover)] py-2"><div className="text-[14px] text-[var(--muted)]">{t.ret}</div><div className="font-mono text-[17px]" style={{ color: sel.bt.ret >= 0 ? "var(--long)" : "var(--short)" }}>{sel.bt.ret >= 0 ? "+" : ""}{pct(lang, sel.bt.ret, 1)}</div></div>
              </div>
              {sel.bt.oos.decided < 10 && <div className="mt-3 text-center text-[14px] text-[var(--saffron)]">{t.lowSample}</div>}
              <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-center text-[13px] text-[var(--muted)]"><span>{t.allHist}: <span dir="ltr" className="font-mono text-[var(--ink)]">{pct(lang, sel.bt.winRate)}</span> ({num(lang, sel.bt.wins)}/{num(lang, sel.bt.losses)})</span><span dir="ltr" className="font-mono">TP {sel.bt.params.rr}R · SL {sel.bt.params.sl}×ATR</span></div>
            </div>

            <div className="relative overflow-hidden rounded-[22px] border p-5" style={{ borderColor: callCol }}>
              {call.fresh && <div className="leon-flare absolute inset-0" style={{ background: `radial-gradient(circle at 85% 0%, ${callCol}33, transparent 60%)` }} />}
              <div className="relative">
                <div className="text-[14px] text-[var(--muted)]">{t.signal} · {t.spot}</div>
                <div className="mt-1">
                  <div className="font-[Outfit] text-[38px] font-bold leading-none tracking-tight" style={{ color: callCol }}>{t.kinds[call.kind]}</div>
                  <div className="mt-1.5 text-[14px] text-[var(--muted)]">{t.kindSub[call.kind]}{sel.bt.live && !call.fresh ? ` ${num(lang, sinceBars)} ${t.barsAgo}` : ""}</div>
                </div>
                <div className="mt-4 text-[14px] text-[var(--muted)]">{t.futures}</div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {call.futures.map((f) => <span key={f} className="rounded-full px-3.5 py-1.5 text-[15px] font-semibold" style={{ background: f.includes("Long") && !f.startsWith("close") ? "var(--long)" : f.includes("Short") && !f.startsWith("close") ? "var(--short)" : "var(--hover)", color: f.startsWith("close") || f === "stayFlat" ? "var(--ink)" : f.includes("Short") ? "#ffffff" : "#0b1128" }}>{t.fut[f]}</span>)}
                </div>
                {call.trade && (
                  <div className="mt-4 rounded-xl bg-[var(--hover)] px-3.5 py-2.5 text-[14px]">
                    <span className="text-[var(--muted)]">{t.lastTrade}: </span>
                    <b style={{ color: call.trade.dir === 1 ? o.up : o.dn }}>{call.trade.dir === 1 ? t.longS : t.shortS}</b>
                    <span dir="ltr" className="mx-2 font-mono text-[var(--ink)]">{fmtPrice(call.trade.entry)} → {fmtPrice(call.trade.exit)}</span>
                    <b style={{ color: call.trade.pnl > 0 ? "var(--long)" : call.trade.pnl < 0 ? "var(--short)" : "var(--muted)" }}>{t.resFull[call.trade.why]}</b>
                  </div>
                )}
                {sel.bt.live && (
                  <div dir="ltr" className={`mt-4 grid grid-cols-4 gap-2 font-mono text-[14px] ${lang === "fa" ? "text-right" : ""}`}>
                    {[[t.entry, fmtPrice(sel.bt.live.entry), "var(--brass)"], [t.stop, fmtPrice(sel.bt.live.sl), "var(--short)"], [t.target, fmtPrice(sel.bt.live.tp), "var(--long)"], [t.upnl, (sel.bt.live.upnl >= 0 ? "+" : "") + (sel.bt.live.upnl * 100).toFixed(2) + "%", sel.bt.live.upnl >= 0 ? "var(--long)" : "var(--short)"]].map(([k, v, c]) => (
                      <div key={k}><div className="font-[inherit] text-[var(--muted)]" style={{ fontFamily: lang === "fa" ? "Vazirmatn" : "Outfit" }}>{k}</div><div style={{ color: c }}>{v}</div></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5">
              <div className="flex justify-between text-[14px] text-[var(--muted)]"><span>{t.consensus}</span><span>{num(lang, results.length)}</span></div>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--hover)]">
                <div style={{ width: `${(cons.l / results.length) * 100}%`, background: "var(--long)", transition: "width .6s" }} />
                <div style={{ width: `${(cons.f / results.length) * 100}%`, background: "var(--line)", transition: "width .6s" }} />
                <div style={{ width: `${(cons.s / results.length) * 100}%`, background: "var(--short)", transition: "width .6s" }} />
              </div>
              <div className="mt-2 flex justify-between text-[14px]"><span className="text-[var(--long)]">{num(lang, cons.l)} {t.bulls}</span><span className="text-[var(--muted)]">{num(lang, cons.f)} {t.flat}</span><span className="text-[var(--short)]">{num(lang, cons.s)} {t.bears}</span></div>
            </div>
          </aside>
        </main>

        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-[inherit] text-[22px] font-semibold text-[var(--ink)]">{t.ranked}</h2>
            <span className="text-[14px] text-[var(--muted)]">{t.modes[mode]} · {coin.n}</span>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[18px] border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5"><span className="me-1 text-[14px] text-[var(--muted)]">{t.filterQ}:</span>{[[true, t.strictOn], [false, t.strictOff]].map(([v, l]) => <button key={l} type="button" onClick={() => set("strict", v)} className={`h-9 rounded-full px-3.5 text-[14px] transition ${o.strict === v ? "bg-[var(--brass)] font-semibold text-[var(--onb)]" : "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"}`}>{l}</button>)}</div>
            <div className="flex flex-wrap items-center gap-1.5"><span className="me-1 text-[14px] text-[var(--muted)]">{t.goalL}:</span>{[["accuracy", t.goalAcc], ["profit", t.goalProfit]].map(([v, l]) => <button key={v} type="button" onClick={() => set("goal", v)} className={`h-9 rounded-full px-3.5 text-[14px] transition ${o.goal === v ? "bg-[var(--brass)] font-semibold text-[var(--onb)]" : "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"}`}>{l}</button>)}</div>
            <label className="flex items-center gap-2 text-[14px] text-[var(--ink)]"><input type="checkbox" checked={!!o.provenOnly} onChange={(e) => set("provenOnly", e.target.checked)} />{t.provenOnly} <span className="font-mono text-[var(--muted)]">{num(lang, results.filter((r) => r.bt.proven).length)}</span></label>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="me-1 text-[14px] text-[var(--muted)]">{t.bestFor}:</span>
            {["all", ...FITS].map((f) => { const n = f === "all" ? shownRes.length : shownRes.filter((r) => r.s.fit.includes(f)).length; if (!n) return null; return <button key={f} type="button" onClick={() => setFitF(f)} className={`h-9 rounded-full px-3.5 text-[14px] transition ${fitF === f ? "bg-[var(--saffron)] font-semibold text-[#0b1128]" : "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"}`}>{f === "all" ? t.allStyles : t.fits[f]} <span className="font-mono opacity-70">{num(lang, n)}</span></button>; })}
          </div>
          <div className="overflow-x-auto rounded-[22px] border border-[var(--line)] bg-[var(--panel)]">
            <table className="w-full min-w-[900px] text-[15px]">
              <thead><tr className="text-[14px] text-[var(--muted)]">
                <th className="w-12 px-4 py-3 text-start font-normal">#</th>
                <th className="px-2 py-3 text-start font-normal">{t.strategy}</th>
                <th className="w-[200px] px-2 py-3 text-start font-normal">{t.oosShort} · {tfLabel(lang, tf)}</th>
                {MODES[mode].tfs.map((x) => <th key={x} className={`px-2 py-3 text-center font-normal ${lang === "fa" ? "" : "font-mono"}`}>{tfLabel(lang, x)}</th>)}
                <th className="px-2 py-3 text-center font-normal">{t.wl[0]}/{t.wl[1]}</th>
                <th className="px-2 py-3 text-center font-normal">{t.pointsCol}</th>
                <th className="px-2 py-3 text-center font-normal">{t.pf}</th>
                <th className="px-2 py-3 text-center font-normal">{t.last}</th>
                <th className="px-4 py-3" />
              </tr></thead>
              <tbody>
                {shownRes.map((r, k) => { if (fitF !== "all" && !r.s.fit.includes(fitF)) return null;
                  const on = r.s.id === sel.s.id; const wr = r.bt.oos.winRate; const c = wr >= 0.6 ? "var(--long)" : wr >= 0.45 ? "var(--saffron)" : "var(--short)";
                  const ck = r.call.kind; const cc = { buy: "var(--long)", holdLong: "var(--long)", tpHit: "var(--long)", sell: "var(--short)", holdShort: "var(--short)", slHit: "var(--short)" }[ck] || "var(--muted)";
                  return (
                    <tr key={r.s.id} onClick={() => setPick(r.s.id)} className={`cursor-pointer border-t border-[var(--line)] transition ${on ? "bg-[var(--hover)]" : "hover:bg-[#161f48]"}`}>
                      <td className="px-4 py-3.5 font-mono text-[var(--muted)]">{num(lang, k + 1)}</td>
                      <td className="px-2 py-3.5"><div className="font-semibold text-[var(--ink)]">{t.s[r.s.id][0]}{r.bt.proven && <span className="ms-2 rounded-full bg-[#9cc23f26] px-2 py-0.5 text-[12px] font-bold text-[var(--long)]">✓ {t.proven}</span>}{r.s.pro && <span className="ms-2 rounded-full border border-[var(--brass)] px-2 py-0.5 text-[12px] font-semibold text-[var(--brass)]">{t.pro}</span>}{k === 0 && <span className="ms-2 rounded-full bg-[var(--saffron)] px-2 py-0.5 text-[12px] font-bold text-[#0b1128]">{t.best}</span>}</div><div className="text-[14px] text-[var(--muted)]">{t.s[r.s.id][1]}</div><div className="mt-1.5 flex flex-wrap gap-1">{r.s.fit.map((f, j) => <span key={f} className={`rounded-full px-2 py-0.5 text-[12px] ${j === 0 ? "bg-[#e9a00e26] font-semibold text-[var(--saffron)]" : "border border-[var(--line)] text-[var(--muted)]"}`}>{t.fits[f]}</span>)}</div></td>
                      <td className="px-2 py-3.5"><div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--grid)]"><div className="h-full rounded-full" style={{ width: `${wr * 100}%`, background: c, transition: "width .8s" }} /></div><span className="w-12 font-mono text-[15px]" style={{ color: c }}>{pct(lang, wr)}</span></div></td>
                      {MODES[mode].tfs.map((x) => { const v = matrix[r.s.id]?.[x]; return <td key={x} className={`px-2 py-3.5 text-center font-mono text-[14px] ${x === tf ? "text-[var(--brass)]" : "text-[var(--muted)]"}`}>{x === tf ? pct(lang, wr) : v == null ? "–" : pct(lang, v)}</td>; })}
                      <td dir="ltr" className="px-2 py-3.5 text-center font-mono text-[14px] text-[var(--muted)]">{r.bt.wins}/{r.bt.losses}</td>
                      <td className="px-2 py-3.5 text-center font-mono text-[14px]" style={{ color: r.bt.points.length >= MIN_POINTS ? "var(--long)" : deepening ? "var(--saffron)" : "var(--short)" }}>{num(lang, r.bt.points.length)}</td>
                      <td className="px-2 py-3.5 text-center font-mono text-[14px] text-[var(--ink)]">{num(lang, r.bt.pf, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</td>
                      <td className="px-2 py-3.5 text-center text-[14px] font-semibold" style={{ color: cc }}>{t.kinds[ck]}</td>
                      <td className="px-4 py-3.5 text-end"><span className={`rounded-full px-3 py-1 text-[14px] ${on ? "bg-[var(--brass)] text-[var(--onb)]" : "border border-[var(--line)] text-[var(--muted)]"}`}>{on ? t.active : t.use}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[14px] text-[var(--muted)]">{t.rule} {t.oosRule}</p>
        </section>

        <StrategyGuide t={t} lang={lang} mode={mode} activeId={sel.s.id} onPick={(s) => { if (!s.modes.includes(mode)) { const m = s.modes.includes("mid") ? "mid" : s.modes[0]; setMode(m); setTf(MODES[m].def); } setPick(s.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} />

        <TradeDesk tr={tr} tt={tt} t={t} lang={lang} sym={sym} tf={tf} price={last.c} sel={sel} strats={results} mode={mode} o={o} />
        <p className="mt-6 text-[14px] text-[var(--muted)]">{t.disclaimer}</p>
      </div>
    </div>
  );
}
