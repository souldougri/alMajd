import { mkdirSync, copyFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = join(root, ".vercel", "output", "static");
const ssrFile = join(root, ".vercel", "output", "functions", "__server.func", "_ssr", "ssr.mjs");
const outDir = join(root, "desktop-web");

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dest, name);
    if (statSync(s).isDirectory()) copyTree(s, d);
    else copyFileSync(s, d);
  }
}

if (statSync(staticDir).isDirectory()) copyTree(staticDir, outDir);
else throw new Error(`static dir missing: ${staticDir}`);

const { default: entry } = await import(`file://${ssrFile.replaceAll("\\", "/")}`);

const res = await entry.fetch(new Request("http://127.0.0.1:8100/", { method: "GET" }));
if (!res.ok) throw new Error(`SSR render failed: ${res.status}`);
let html = await res.text();
if (!html.includes("$_TSR")) throw new Error("SSR render missing hydration bootstrap data");

// Strip external Google Fonts links (won't work offline in Electron)
html = html.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"\/?>/g, "");
html = html.replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*\/?>/g, "");
html = html.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*"[^>]*\/?>/g, "");

writeFileSync(join(outDir, "index.html"), html, "utf8");
console.log(`[build-electron-web] ${html.length.toLocaleString()} bytes -> desktop-web/index.html`);
console.log(`[build-electron-web] static assets -> desktop-web/`);