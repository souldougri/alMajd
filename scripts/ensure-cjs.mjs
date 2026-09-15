import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "electron", "dist");
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, "package.json"), '{"type":"commonjs"}\n', "utf8");
console.log("[ensure-cjs] electron/dist/package.json -> commonjs");