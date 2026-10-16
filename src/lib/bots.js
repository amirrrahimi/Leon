// Bot decision logic (pure, no side effects). A bot follows ONE strategy on ONE coin + timeframe and
// reacts only to signals on candles that closed AFTER it was armed (never to old signals).
import { STRATS, backtest, makeElite } from "./strategies";
import { TF_SEC } from "./market";
export const pollMs = (tf) => Math.min(60000, Math.max(10000, (TF_SEC[tf] * 1000) / 12));
export const stratFor = (bot) => {
  const s = bot.strat === "elite" && bot.members ? makeElite(STRATS.filter((x) => bot.members.includes(x.id)), bot.mode || "mid") : STRATS.find((x) => x.id === bot.strat);
  return s && bot.rr && bot.rr !== "auto" ? { ...s, rr: +bot.rr, fixedRR: true } : s;
};

// returns { actions: [...], patch: {...} } where actions are: {type:"close", why} | {type:"open", dir, sl, tp} | {type:"moveBE"}
export function decide(bot, bars) {
  const s = stratFor(bot); if (!s || bars.length < 80) return { actions: [], patch: { status: "noData" } };
  const bt = backtest(bars, s, { strict: bot.strict ?? true, tune: true, goal: bot.goal || "accuracy" }); const rr = bt.params.rr;
  const last = bars[bars.length - 1], price = last.c, tfs = TF_SEC[bot.tf];
  const actions = []; const patch = { status: "watching", price, checked: Date.now() };
  const pos = bot.pos;
  // 1) guard the open position (live bots; paper positions are guarded by the test account itself)
  if (pos && bot.account !== "paper") {
    const fresh = last.t > (pos.barT || 0); const hi = fresh ? Math.max(last.h, price) : price, lo = fresh ? Math.min(last.l, price) : price;
    const hitS = pos.dir === 1 ? lo <= pos.sl : hi >= pos.sl, hitT = pos.dir === 1 ? hi >= pos.tp : lo <= pos.tp;
    if (hitS) actions.push({ type: "close", why: pos.be ? "be" : "sl", price: pos.sl });
    else if (hitT) actions.push({ type: "close", why: "tp", price: pos.tp });
    else { const R = Math.abs(pos.entry - pos.sl0); if (!pos.be && R && (pos.dir === 1 ? hi >= pos.entry + R : lo <= pos.entry - R)) actions.push({ type: "moveBE" }); }
  }
  // 2) new signal on a closed candle after arming
  if (bt.lastSig >= 0) {
    const sigT = bars[bt.lastSig].t, closedAt = (sigT + tfs) * 1000;
    const recent = bars.length - 2 - bt.lastSig <= 1;
    if (sigT > (bot.lastSigT || 0) && closedAt > bot.armedAt && recent) {
      patch.lastSigT = sigT;
      const dir = bt.lastDir; const closing = actions.some((a) => a.type === "close");
      if (pos && pos.dir !== dir && !closing) actions.push({ type: "close", why: "rev", price });
      const flat = !pos || pos.dir !== dir;
      if (flat && (bot.market === "futures" || dir === 1) && bt.live && bt.live.entryI === bt.lastSig) {
        const d = Math.abs(bt.live.entry - bt.live.sl0); // risk distance measured by the strategy (ATR based)
        actions.push({ type: "open", dir, price, sl: price - dir * d, tp: price + dir * d * rr, barT: last.t });
      }
    } else if (sigT > (bot.lastSigT || 0)) patch.lastSigT = sigT; // stale or pre-arm signal: remember and ignore
  }
  return { actions, patch, bt };
}
