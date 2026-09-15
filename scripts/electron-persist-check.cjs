/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Persistence verification for the Electron desktop build.
 *
 * Runs the REAL compiled main process (electron/dist/main.js) against a
 * temporary userData directory in two phases:
 *
 *   phase "write": through the real preload bridge, writes a marker document
 *                  to <userData>/al-majd-school.json and reads it back.
 *   phase "read":  starts a fresh process (same profile), asserts the file
 *                  still equals the marker AND that the renderer hydrated it
 *                  (marker student name visible in the dashboard DOM).
 *
 * Exits 0 only if both phases pass.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const electronBin = require("electron"); // resolves to the electron binary path

const root = path.join(__dirname, "..");
const mainJs = path.join(root, "electron", "dist", "main.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "almadjd-persist-"));
const userData = path.join(tmp, "profile");

function runPhase(phase) {
  const res = spawnSync(electronBin, [mainJs], {
    cwd: root,
    env: {
      ...process.env,
      ALMAJD_PERSIST_TEST: phase,
      ALMAJD_TEST_USERDATA: userData,
      ELECTRON_START_URL: "",
    },
    encoding: "utf8",
    timeout: 90000,
  });
  const stdout = res.stdout || "";
  const line = stdout.split("\n").find((l) => l.startsWith("PERSIST_TEST_RESULT="));
  if (!line) {
    return { ok: false, error: "no PERSIST_TEST_RESULT in stdout", tail: stdout.slice(-500) };
  }
  try {
    return JSON.parse(line.slice("PERSIST_TEST_RESULT=".length));
  } catch (err) {
    return { ok: false, error: String(err), raw: line };
  }
}

let exitCode = 1;
try {
  const writeRes = runPhase("write");
  const readRes = runPhase("read");
  console.log("persist-phase-write=" + JSON.stringify(writeRes));
  console.log("persist-phase-read=" + JSON.stringify(readRes));
  if (writeRes.ok && readRes.ok) {
    console.log("PERSIST_CHECK=ok");
    exitCode = 0;
  } else {
    console.log("PERSIST_CHECK=fail");
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(exitCode);