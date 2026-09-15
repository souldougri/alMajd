import sharp from "sharp";
import pngToIco from "png-to-ico";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "public", "brand", "logo.jpg");
const buildDir = join(root, "build");
mkdirSync(buildDir, { recursive: true });

const meta = await sharp(src).metadata();
const base = Math.max(meta.width ?? 256, meta.height ?? 256);
const square = meta.width && meta.height && Math.abs(meta.width - meta.height) <= 4
  ? sharp(src)
  : sharp(src).resize(base, base, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } });

const sizes = [16, 32, 48, 64, 128, 256];
const pngs = [];
for (const size of sizes) {
  const buf = await square.clone().resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  pngs.push(buf);
}
await square.clone().resize(256, 256, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toFile(join(buildDir, "icon.png"));
const ico = await pngToIco(pngs);
await (await import("node:fs")).promises.writeFile(join(buildDir, "icon.ico"), ico);
console.log(`[build-icon] build/icon.ico (${sizes.join(", ")}px) + build/icon.png`);