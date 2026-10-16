const { app, BrowserWindow, shell, ipcMain, powerSaveBlocker } = require("electron");
const path = require("path");
let awake = null;

// Only these hosts may be reached from the app (exchange REST + Binance market data)
const ALLOW = /^https:\/\/(api\.binance\.com|api\.binance\.us|data-api\.binance\.vision|api-testnet\.bybit\.com|api\.bybit\.com|www\.okx\.com|api\.kucoin\.com|api-futures\.kucoin\.com|api\.bitget\.com|api\.toobit\.com|testnet\.binance\.vision|testnet\.binancefuture\.com|fapi\.binance\.com)\//;

ipcMain.handle("leon:http", async (_e, { url, method = "GET", headers = {}, body }) => {
  if (!ALLOW.test(url)) return { error: "host not allowed" };
  try {
    const r = await fetch(url, { method, headers, body });
    return { status: r.status, text: await r.text() };
  } catch (err) {
    return { error: "Failed to fetch" };
  }
});
ipcMain.on("leon:keepAwake", (_e, on) => {
  if (on && awake === null) awake = powerSaveBlocker.start("prevent-app-suspension");
  if (!on && awake !== null) { powerSaveBlocker.stop(awake); awake = null; }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 960, minWidth: 1024, minHeight: 700,
    title: "Leon", backgroundColor: "#0b1128", autoHideMenuBar: true,
    icon: path.join(__dirname, "../build/icon.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, preload: path.join(__dirname, "preload.cjs") }, // keep feeds + signal alerts running when minimised
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  if (process.env.VITE_DEV) win.loadURL("http://localhost:5173");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
}
app.whenReady().then(() => { createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
