import sharp from "sharp";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = join(root, "public", "brand", "logo.jpg");
const logoB64 = readFileSync(logoPath).toString("base64");

const NAVY = "#14324D";
const GOLD = "#D89A3E";
const GOLD_LIGHT = "#F6E2B6";

function splashSvg() {
  return `
<svg width="1200" height="1920" viewBox="0 0 1200 1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.7">
      <stop offset="0%" stop-color="#D89A3E" stop-opacity="0.28"/>
      <stop offset="55%" stop-color="#D89A3E" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#14324D" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="seal"><circle cx="600" cy="872" r="205"/></clipPath>
  </defs>
  <rect width="1200" height="1920" fill="${NAVY}"/>
  <rect width="1200" height="1920" fill="url(#glow)"/>
  <circle cx="600" cy="872" r="252" fill="none" stroke="${GOLD}" stroke-width="7" opacity="0.9"/>
  <circle cx="600" cy="872" r="236" fill="none" stroke="${GOLD}" stroke-width="2" opacity="0.45"/>
  <g clip-path="url(#seal)">
    <image href="data:image/jpeg;base64,${logoB64}" x="395" y="667" width="410" height="410" preserveAspectRatio="xMidYMid slice"/>
  </g>
  <text x="600" y="1120" text-anchor="middle" font-family="Segoe UI, Tajawal, Arial" font-size="88" font-weight="700" fill="${GOLD_LIGHT}">مجمع المجد</text>
  <text x="600" y="1176" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" letter-spacing="10" fill="${GOLD}">AL MAJD</text>
  <rect x="470" y="1210" width="260" height="3" fill="${GOLD}" opacity="0.6"/>
  <text x="600" y="1256" text-anchor="middle" font-family="Segoe UI, Tajawal, Arial" font-size="34" fill="#FFFFFF" opacity="0.65">التعليم الإنساني .. والعلم النافع</text>
</svg>`;
}

// Port/land splash sizes in logical px per density (Capacitor defaults).
const SPLASH_SIZES = {
  mdpi: { port: { w: 480, h: 800 }, land: { w: 800, h: 480 } },
  hdpi: { port: { w: 720, h: 1200 }, land: { w: 1280, h: 720 } },
  xhdpi: { port: { w: 960, h: 1600 }, land: { w: 1600, h: 960 } },
  xxhdpi: { port: { w: 1440, h: 2400 }, land: { w: 2400, h: 1440 } },
  xxxhdpi: { port: { w: 1920, h: 3200 }, land: { w: 3200, h: 1920 } },
};

const MIPMAP_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

const resDir = join(root, "android", "app", "src", "main", "res");
const splash = sharp(Buffer.from(splashSvg()));

async function rounded(src, size, radius) {
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${radius}" fill="white"/></svg>`,
  );
  return src.composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

async function logoBadge(px) {
  const pad = Math.round(px * 0.1);
  const size = px - pad * 2;
  const img = sharp(logoPath).resize(size, size, { fit: "cover" });
  return rounded(img, size, Math.round(size * 0.24));
}

async function launcherIcon(px, round) {
  const pad = Math.round(px * 0.1);
  const size = px - pad * 2;
  const radius = round ? px / 2 : Math.round(px * 0.12);
  const bg = Buffer.from(
    `<svg width="${px}" height="${px}" xmlns="http://www.w3.org/2000/svg"><rect width="${px}" height="${px}" fill="${NAVY}" rx="${radius}"/><circle cx="${px / 2}" cy="${px / 2}" r="${Math.round(px * 0.34)}" fill="none" stroke="${GOLD}" stroke-width="${Math.max(1, Math.round(px * 0.02))}" opacity="0.85"/></svg>`,
  );
  const badge = logoBadge(px);
  return sharp(bg)
    .composite([{ input: await badge, left: Math.round((px - size) / 2), top: Math.round((px - size) / 2) }])
    .png()
    .toBuffer();
}

async function launcherForeground(px) {
  const pad = Math.round(px * 0.26);
  const size = px - pad * 2;
  const img = sharp(logoPath).resize(size, size, { fit: "cover" });
  return rounded(img, size, Math.round(size * 0.24));
}

for (const [density, sizes] of Object.entries(SPLASH_SIZES)) {
  const portDir = join(resDir, `drawable-port-${density}`);
  const landDir = join(resDir, `drawable-land-${density}`);
  mkdirSync(portDir, { recursive: true });
  mkdirSync(landDir, { recursive: true });
  await splash.clone().resize(sizes.port.w, sizes.port.h).png().toFile(join(portDir, "splash.png"));
  await splash.clone().resize(sizes.land.w, sizes.land.h).png().toFile(join(landDir, "splash.png"));
}

for (const [density, px] of Object.entries(MIPMAP_SIZES)) {
  const dir = join(resDir, `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });
  const files = [
    ["ic_launcher.png", await launcherIcon(px, false)],
    ["ic_launcher_round.png", await launcherIcon(px, true)],
    ["ic_launcher_foreground.png", await launcherForeground(px * 3)],
  ];
  for (const [name, buf] of files) writeFileSync(join(dir, name), buf);
}

console.log("[build-mobile-assets] Android splash + launcher icons regenerated.");