// Exposes a tiny, safe bridge to the page: exchange requests go through the main process (no browser CORS).
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("leonNative", {
  http: (req) => ipcRenderer.invoke("leon:http", req),
  keepAwake: (on) => ipcRenderer.send("leon:keepAwake", !!on),
});
