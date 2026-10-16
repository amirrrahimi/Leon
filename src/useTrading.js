// Trading engine: test account + exchange connections + bots + safety rails. All state lives on this device.
import { useCallback, useEffect, useRef, useState } from "react";
import { loadHistory } from "./lib/feed";
import { decide } from "./lib/bots";
import { pollMs } from "./lib/bots";
import { newPaper, paperOpen, paperClose, paperMark, equity } from "./lib/paper";
import { openOrder, closeOrder, balanceOf, exchange } from "./lib/exchanges";
import { vaultExists, vaultOpen, vaultSave, vaultWipe } from "./lib/crypto";
import { keepAwake } from "./lib/platform";

const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const usePersist = (k, d) => { const [v, setV] = useState(() => load(k, d)); useEffect(() => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, [k, v]); return [v, setV]; };
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
export const RISK_DEFAULTS = { maxMargin: 50, dailyLoss: 50, confirm: true };

export default function useTrading() {
  const [paper, setPaper] = usePersist("leon-paper", newPaper(1000, 0.1));
  const [bots, setBots] = usePersist("leon-bots", []);
  const [log, setLog] = usePersist("leon-log", []);
  const [risk, setRisk] = usePersist("leon-risk", RISK_DEFAULTS);
  const [day, setDay] = usePersist("leon-day", { d: today(), pnl: 0, paused: false });
  const [manual, setManual] = usePersist("leon-manual", []); // live positions opened by hand from Leon
  const [creds, setCreds] = useState(null); // decrypted keys, memory only
  const [pending, setPending] = useState([]);
  const S = useRef({}); S.current = { paper, bots, creds, risk, day, pending };
  const busy = useRef(new Set());

  const note = useCallback((e) => setLog((l) => [{ id: uid(), t: Date.now(), ...e }, ...l].slice(0, 200)), []);
  const patchBot = useCallback((id, p) => setBots((bs) => bs.map((b) => (b.id === id ? { ...b, ...(typeof p === "function" ? p(b) : p) } : b))), []);
  useEffect(() => { if (day.d !== today()) setDay({ d: today(), pnl: 0, paused: false }); }, [day.d]);
  useEffect(() => { keepAwake(bots.some((b) => b.on)); }, [bots]);

  // ---- vault ----
  const hasVault = vaultExists();
  const unlock = async (pin) => { const c = await vaultOpen(pin); setCreds({ ...c, _pin: pin }); return c; };
  const saveCred = async (pin, id, cred) => { const cur = creds || (hasVault ? await vaultOpen(pin) : {}); const { _pin, ...rest } = cur; const next = { ...rest, [id]: cred }; await vaultSave(pin, next); setCreds({ ...next, _pin: pin }); };
  const removeCred = async (id) => { if (!creds) return; const { _pin, [id]: _, ...rest } = creds; await vaultSave(_pin, rest); setCreds({ ...rest, _pin }); setBots((bs) => bs.map((b) => (b.account === id ? { ...b, on: false } : b))); };
  const lock = () => { setCreds(null); setBots((bs) => bs.map((b) => (b.account !== "paper" ? { ...b, on: false } : b))); };
  const wipe = () => { vaultWipe(); lock(); };
  const testCred = async (id, cred) => { const ex = exchange(id); const out = {}; for (const m of ex.markets) { try { out[m] = await balanceOf(id, cred, m); } catch (e) { out[m] = { error: e.message }; } } return out; };

  // ---- test account ----
  const resetPaper = (start, fee) => { setPaper(newPaper(start, fee)); setBots((bs) => bs.map((b) => (b.account === "paper" ? { ...b, pos: null } : b))); note({ kind: "reset", acct: "paper", amount: +start }); };
  const markPaper = useCallback((sym, price) => {
    const a = S.current.paper; if (!a.positions.some((p) => p.sym === sym)) return;
    const r = paperMark(a, sym, price, price, price); S.current.paper = r.acc; setPaper(r.acc);
    r.closed.forEach((tr) => note({ kind: "close", acct: "paper", sym, dir: tr.dir, price: tr.exit, why: tr.why, pnl: tr.pnl }));
  }, [note]);
  const paperManual = (o) => { try { const r = paperOpen(S.current.paper, o); setPaper(r.acc); note({ kind: "open", acct: "paper", sym: o.sym, dir: r.pos.dir, price: o.price, usdt: r.pos.margin }); return r.pos; } catch (e) { note({ kind: "error", acct: "paper", sym: o.sym, text: e.message }); } };
  const paperCloseManual = (id, price) => { const r = paperClose(S.current.paper, id, price, "manual"); setPaper(r.acc); if (r.trade) note({ kind: "close", acct: "paper", sym: r.trade.sym, dir: r.trade.dir, price, why: "manual", pnl: r.trade.pnl }); };

  // ---- live order helpers (with safety rails) ----
  const liveCred = (acct) => { const c = S.current.creds?.[acct]; if (!c) throw new Error("locked"); return c; };
  const liveGuard = (acct) => { const c = liveCred(acct); if (S.current.day.paused) throw new Error("dailyLimit"); return c; }; // opening only; closing is always allowed
  const bookPnl = (pnl) => setDay((d) => { const n = { ...d, pnl: d.pnl + pnl }; if (n.pnl <= -Math.abs(S.current.risk.dailyLoss) && S.current.risk.dailyLoss > 0) { n.paused = true; setBots((bs) => bs.map((b) => (b.account !== "paper" ? { ...b, on: false } : b))); note({ kind: "pause", acct: "live", pnl: n.pnl }); } return n; });

  async function sizeFor(bot, price) {
    let base; if (bot.account === "paper") base = equity(S.current.paper, { [bot.sym]: price }); else base = await balanceOf(bot.account, liveCred(bot.account), bot.market);
    let margin = bot.sizeMode === "pct" ? (base * bot.size) / 100 : +bot.size;
    if (bot.account !== "paper") margin = Math.min(margin, +S.current.risk.maxMargin || margin, base);
    return margin;
  }
  async function execOpen(bot, a) {
    const lev = bot.market === "spot" ? 1 : +bot.lev || 1; const margin = await sizeFor(bot, a.price);
    if (!(margin > 0)) throw new Error("insufficient");
    if (bot.account === "paper") {
      const r = paperOpen(S.current.paper, { sym: bot.sym, market: bot.market, dir: a.dir, margin, lev, price: a.price, sl: a.sl, tp: a.tp, src: bot.id });
      S.current.paper = r.acc; setPaper(r.acc);
      patchBot(bot.id, { pos: { paperId: r.pos.id, dir: a.dir, entry: a.price, sl: a.sl, sl0: a.sl, tp: a.tp, be: false, qty: r.pos.qty, barT: a.barT } });
      note({ kind: "open", acct: "paper", sym: bot.sym, dir: a.dir, price: a.price, usdt: margin, bot: bot.strat });
      return;
    }
    const cred = liveGuard(bot.account);
    const res = await openOrder(bot.account, cred, { sym: bot.sym, market: bot.market, dir: a.dir, usdt: margin * lev, lev, price: a.price, sl: a.sl, tp: a.tp });
    patchBot(bot.id, { pos: { dir: a.dir, entry: a.price, sl: a.sl, sl0: a.sl, tp: a.tp, be: false, qty: res.qty, nativeSLTP: res.nativeSLTP, barT: a.barT, orderId: res.id } });
    note({ kind: "open", acct: bot.account, sym: bot.sym, dir: a.dir, price: a.price, usdt: margin, lev, bot: bot.strat, market: bot.market });
  }
  async function execClose(bot, a) {
    const pos = bot.pos; if (!pos) return;
    if (bot.account === "paper") {
      const r = paperClose(S.current.paper, pos.paperId, a.price, a.why); S.current.paper = r.acc; setPaper(r.acc);
      if (r.trade) note({ kind: "close", acct: "paper", sym: bot.sym, dir: pos.dir, price: a.price, why: a.why, pnl: r.trade.pnl });
    } else {
      const res = await closeOrder(bot.account, liveCred(bot.account), { sym: bot.sym, market: bot.market, dir: pos.dir, qty: pos.qty, price: a.price });
      const pnl = pos.dir * pos.qty * (a.price - pos.entry); bookPnl(pnl);
      note({ kind: "close", acct: bot.account, sym: bot.sym, dir: pos.dir, price: a.price, why: res.skipped ? "already" : a.why, pnl, market: bot.market });
    }
    patchBot(bot.id, { pos: null }); bot.pos = null;
  }

  // ---- bot loop ----
  const runBot = useCallback(async (bot) => {
    if (busy.current.has(bot.id)) return; busy.current.add(bot.id); bot = { ...bot };
    try {
      const bars = await loadHistory(bot.sym, bot.tf, 1000);
      if (bars.live === false && bot.account !== "paper") { patchBot(bot.id, { status: "noData", checked: Date.now() }); return; }
      const last = bars[bars.length - 1];
      let clear = false;
      if (bot.account === "paper") {
        markPaper(bot.sym, last.c);
        const still = S.current.paper.positions.some((p) => p.id === bot.pos?.paperId);
        if (bot.pos && !still) { bot = { ...bot, pos: null }; clear = true; }
      }
      const { actions, patch } = decide(bot, bars);
      patchBot(bot.id, clear ? { ...patch, pos: null } : patch);
      for (const a of actions) {
        try {
          if (a.type === "moveBE") { patchBot(bot.id, (b) => ({ pos: b.pos && { ...b.pos, sl: b.pos.entry, be: true } })); bot.pos = { ...bot.pos, sl: bot.pos.entry, be: true }; }
          if (a.type === "close") await execClose(bot, a);
          if (a.type === "open") {
            if (bot.confirm) { setPending((p) => [...p.filter((x) => x.botId !== bot.id), { id: uid(), botId: bot.id, ...a, created: Date.now(), sym: bot.sym, account: bot.account, market: bot.market }]); note({ kind: "pending", acct: bot.account, sym: bot.sym, dir: a.dir, price: a.price, bot: bot.strat }); }
            else await execOpen(bot, a);
          }
        } catch (e) { note({ kind: "error", acct: bot.account, sym: bot.sym, text: e.message }); patchBot(bot.id, { status: "error", error: e.message }); }
      }
    } catch (e) { patchBot(bot.id, { status: "error", error: e.message }); }
    finally { busy.current.delete(bot.id); }
  }, [markPaper, note, patchBot]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setPending((p) => p.filter((x) => now - x.created < 3 * 60e3)); // a signal you don't approve within 3 minutes expires
      for (const b of S.current.bots) if (b.on && (!b.checked || now - b.checked >= pollMs(b.tf))) { if (b.account !== "paper" && !S.current.creds?.[b.account]) continue; runBot(b); }
    }, 4000);
    const px = setInterval(() => {
      const syms = [...new Set(S.current.paper.positions.map((p) => p.sym))];
      syms.forEach((sym) => loadHistory(sym, "1m", 3).then((b) => { if (b.live !== false) markPaper(sym, b[b.length - 1].c); }).catch(() => {}));
    }, 30000);
    return () => { clearInterval(id); clearInterval(px); };
  }, [runBot, markPaper]);

  const approve = async (pid) => {
    const p = S.current.pending.find((x) => x.id === pid); setPending((ps) => ps.filter((x) => x.id !== pid)); if (!p) return;
    const bot = S.current.bots.find((b) => b.id === p.botId); if (!bot || bot.pos) return;
    try { await execOpen(bot, p); } catch (e) { note({ kind: "error", acct: bot.account, sym: bot.sym, text: e.message }); }
  };
  const reject = (pid) => setPending((ps) => ps.filter((x) => x.id !== pid));

  const addBot = (b) => setBots((bs) => [...bs, { id: uid(), on: true, armedAt: Date.now(), lastSigT: 0, pos: null, status: "starting", confirm: b.account === "paper" ? false : S.current.risk.confirm, ...b }]);
  const toggleBot = (id) => patchBot(id, (b) => ({ on: !b.on, armedAt: !b.on ? Date.now() : b.armedAt, status: !b.on ? "starting" : "stopped" }));
  const removeBot = async (id, price) => { const b = S.current.bots.find((x) => x.id === id); if (b?.pos && price) { try { await execClose(b, { why: "manual", price }); } catch (e) { note({ kind: "error", acct: b.account, sym: b.sym, text: e.message }); return; } } setBots((bs) => bs.filter((x) => x.id !== id)); };
  const closeBotPos = async (id, price) => { const b = S.current.bots.find((x) => x.id === id); if (!b?.pos) return; try { await execClose(b, { why: "manual", price }); } catch (e) { note({ kind: "error", acct: b.account, sym: b.sym, text: e.message }); } };
  const stopAll = () => { setBots((bs) => bs.map((b) => ({ ...b, on: false, status: "stopped" }))); setPending([]); note({ kind: "stopAll" }); };

  // manual live order from the trade panel
  const liveManual = async ({ acct, sym, market, dir, margin, lev, price }) => {
    const cred = liveGuard(acct); const L = market === "spot" ? 1 : lev; const m = Math.min(margin, +S.current.risk.maxMargin || margin);
    const res = await openOrder(acct, cred, { sym, market, dir: market === "spot" ? 1 : dir, usdt: m * L, lev: L, price });
    setManual((ms) => [{ id: uid(), acct, sym, market, dir: market === "spot" ? 1 : dir, qty: res.qty, entry: price, lev: L, margin: m, t: Date.now() }, ...ms]);
    note({ kind: "open", acct, sym, dir, price, usdt: m, lev: L, market });
  };
  const liveManualClose = async (id, price) => {
    const p = manual.find((x) => x.id === id); if (!p) return;
    const res = await closeOrder(p.acct, liveCred(p.acct), { sym: p.sym, market: p.market, dir: p.dir, qty: p.qty, price });
    const pnl = p.dir * p.qty * (price - p.entry); bookPnl(pnl); setManual((ms) => ms.filter((x) => x.id !== id));
    note({ kind: "close", acct: p.acct, sym: p.sym, dir: p.dir, price, why: res.skipped ? "already" : "manual", pnl, market: p.market });
  };

  return { paper, resetPaper, markPaper, paperManual, paperCloseManual, bots, addBot, toggleBot, removeBot, closeBotPos, stopAll, patchBot,
    pending, approve, reject, log, clearLog: () => setLog([]), risk, setRisk, day, resume: () => setDay((d) => ({ ...d, paused: false })),
    creds, hasVault, unlock, lock, wipe, saveCred, removeCred, testCred, manual, liveManual, liveManualClose };
}
