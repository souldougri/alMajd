/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const http = require("http");
const path = require("path");

const WEB = path.join(__dirname, "..", "desktop-web");
const PORT = 19821;

function serve(port) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        let fp = path.normalize(path.join(WEB, decodeURIComponent(url.pathname)));
        if (!fp.startsWith(WEB)) { res.writeHead(403); return res.end("Forbidden"); }
        if (fp.endsWith(path.sep) || path.extname(fp) === "") fp = path.join(fp, "index.html");
        if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) fp = path.join(WEB, "index.html");
        const exts = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".svg":"image/svg+xml", ".jpg":"image/jpeg", ".png":"image/png", ".mjs":"text/javascript; charset=utf-8", ".json":"application/json", ".ico":"image/x-icon", ".woff2":"font/woff2" };
        res.writeHead(200, { "Content-Type": exts[path.extname(fp).toLowerCase()] || "application/octet-se" });
        res.end(fs.readFileSync(fp));
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    srv.once("error", reject);
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}

app.whenReady().then(async () => {
  let result = { ok: false, checks: {}, errors: [] };
  const srv = await serve(PORT);
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "..", "electron", "dist", "preload.js"),
    },
  });
  const consoleErrors = [];
  win.webContents.on("console-message", (_e, _lvl, msg) => consoleErrors.push(msg));
  try {
    await win.loadURL(`http://127.0.0.1:${PORT}/`);
    await new Promise((r) => setTimeout(r, 5000));
    const probe = await win.webContents.executeJavaScript(`JSON.stringify({
      appFrame: !!document.querySelector(".app-frame"),
      header: !!document.querySelector("header.no-print"),
      title: document.title,
      bodyLen: document.body.innerHTML.length,
      desktopApi: typeof window.alMajd?.saveBackup === "function" && typeof window.alMajd?.openBackup === "function",
      desktopApi2: typeof window.alMajd?.getDocument === "function" && typeof window.alMajd?.writeDocument === "function" && typeof window.alMajd?.flushDocument === "function",
      desktopFlag: window.alMajdDesktop === true,
    })`);
    result.checks = JSON.parse(probe);
    result.errors = consoleErrors.filter((m) => /error|exception|failed|invariant/i.test(m));
    result.ok = result.checks.appFrame && result.checks.header && result.checks.desktopFlag && result.checks.desktopApi && result.checks.desktopApi2;
  } catch (e) {
    result.errors.push(String(e));
  }
  console.log("VERIFY_RESULT=" + JSON.stringify(result, null, 2));
  srv.close();
  win.destroy();
  app.exit(result.ok ? 0 : 1);
});