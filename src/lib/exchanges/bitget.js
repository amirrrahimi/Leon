// Bitget v2: spot + USDT-M futures (crossed margin, one-way mode). Preset SL/TP attached on futures.
import { hmacB64 } from "../crypto";
import { qs, floorStep, px, call, cached } from "./util";
const H = "https://api.bitget.com"; const PT = "USDT-FUTURES";
const ok = (d, s) => (d?.code !== "00000" ? d?.msg || `HTTP ${s}` : null);
async function req(c, method, path, params = {}) {
  const ts = String(Date.now()); const isGet = method === "GET";
  const q = isGet ? qs(params) : ""; const body = isGet ? "" : JSON.stringify(params);
  const sign = await hmacB64(c.secret, ts + method + path + (q ? "?" + q : "") + body);
  return call("Bitget", { url: H + path + (q ? "?" + q : ""), method, body: isGet ? undefined : body,
    headers: { "ACCESS-KEY": c.key, "ACCESS-SIGN": sign, "ACCESS-TIMESTAMP": ts, "ACCESS-PASSPHRASE": c.pass, locale: "en-US", "Content-Type": "application/json" } }, ok);
}
async function rules(sym, m) {
  return cached(`bg${m}${sym}`, async () => {
    if (m === "spot") { const s = (await call("Bitget", { url: `${H}/api/v2/spot/public/symbols?symbol=${sym}USDT` }, ok)).data[0]; if (!s) throw new Error(`Bitget: ${sym}USDT not listed`); return { step: (10 ** -+s.quantityPrecision).toFixed(+s.quantityPrecision), min: +s.minTradeAmount || 0 }; }
    const s = (await call("Bitget", { url: `${H}/api/v2/mix/market/contracts?productType=${PT}&symbol=${sym}USDT` }, ok)).data[0]; if (!s) throw new Error(`Bitget: ${sym}USDT futures not listed`);
    return { step: s.sizeMultiplier, min: +s.minTradeNum };
  });
}
async function spotFree(c, coin) { const d = await req(c, "GET", "/api/v2/spot/account/assets", { coin }); return +(d.data[0]?.available || 0); }
export default {
  id: "bitget", name: "Bitget", markets: ["spot", "futures"], testnet: false, pass: true,
  async balance(c, m) { if (m === "spot") return spotFree(c, "USDT"); const d = await req(c, "GET", "/api/v2/mix/account/accounts", { productType: PT }); return +(d.data.find((x) => x.marginCoin === "USDT")?.available || 0); },
  async open(c, { sym, market, dir, usdt, lev, price, sl, tp, withSLTP }) {
    if (market === "spot") { const r = await req(c, "POST", "/api/v2/spot/trade/place-order", { symbol: sym + "USDT", side: "buy", orderType: "market", force: "gtc", size: usdt.toFixed(2) }); return { id: r.data.orderId, qty: usdt / price }; }
    const R = await rules(sym, market);
    await req(c, "POST", "/api/v2/mix/account/set-leverage", { symbol: sym + "USDT", productType: PT, marginCoin: "USDT", leverage: String(lev) }).catch(() => {});
    const size = floorStep(usdt / price, R.step); if (+size < R.min) throw new Error(`Bitget: order below minimum size (${R.min})`);
    const r = await req(c, "POST", "/api/v2/mix/order/place-order", { symbol: sym + "USDT", productType: PT, marginMode: "crossed", marginCoin: "USDT", size, side: dir === 1 ? "buy" : "sell", orderType: "market",
      ...(withSLTP ? { presetStopSurplusPrice: px(tp), presetStopLossPrice: px(sl) } : {}) });
    return { id: r.data.orderId, qty: +size };
  },
  async close(c, { sym, market, qty }) {
    if (market === "spot") {
      const R = await rules(sym, market); const free = await spotFree(c, sym);
      const q = floorStep(Math.min(qty, free), R.step); if (+q <= 0 || +q < R.min) return { id: null, skipped: true };
      const r = await req(c, "POST", "/api/v2/spot/trade/place-order", { symbol: sym + "USDT", side: "sell", orderType: "market", force: "gtc", size: q }); return { id: r.data.orderId };
    }
    const p = (await req(c, "GET", "/api/v2/mix/position/single-position", { symbol: sym + "USDT", productType: PT, marginCoin: "USDT" })).data?.find((x) => +x.total > 0);
    if (!p) return { id: null, skipped: true };
    await req(c, "POST", "/api/v2/mix/order/close-positions", { symbol: sym + "USDT", productType: PT });
    return { id: "close" };
  },
};
