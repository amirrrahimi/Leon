// Exchange registry. Every adapter implements: balance(cred, market) · open(cred, order) · close(cred, order)
// order = { sym, market: "spot" | "futures", dir: 1 | -1, usdt, lev, price, sl, tp, withSLTP, qty }
// Spot can only go long: a SELL signal closes the long instead of opening a short.
import binance from "./binance";
import bybit from "./bybit";
import okx from "./okx";
import kucoin from "./kucoin";
import bitget from "./bitget";
import toobit from "./toobit";
export const EXCHANGES = [binance, bybit, okx, kucoin, bitget, toobit];
export const exchange = (id) => EXCHANGES.find((e) => e.id === id);
// Exchanges that can attach the stop-loss / take-profit to the futures order itself
export const NATIVE_SLTP = ["bybit", "okx", "bitget", "toobit"];
export async function openOrder(id, cred, order) {
  const ex = exchange(id); const withSLTP = order.market === "futures" && NATIVE_SLTP.includes(id) && order.sl && order.tp;
  try { return { ...(await ex.open(cred, { ...order, withSLTP })), nativeSLTP: !!withSLTP }; }
  catch (e) { if (!withSLTP || e.raw === undefined) throw e; // exchange rejected the SL/TP: retry plain (Leon still guards SL/TP)
    return { ...(await ex.open(cred, { ...order, withSLTP: false })), nativeSLTP: false }; }
}
export const closeOrder = (id, cred, order) => exchange(id).close(cred, order);
export const balanceOf = (id, cred, market) => exchange(id).balance(cred, market);
