import { app, BrowserWindow, dialog, ipcMain, nativeImage } from "electron";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

const APP_ID = "com.almadjd.sis";
const APP_TITLE = "نظام إدارة مجمع المجد التعليمي العربي";
const DEV_URL = process.env.ELECTRON_START_URL;

// Single source of truth for the desktop build: a JSON document under the
// userData directory (never inside the asar / Program Files, which is read-only).
const SCHOOL_DOC_FILE = "al-majd-school.json";

const PERSIST_TEST = process.env.ALMAJD_PERSIST_TEST; // "write" | "read" | undefined

// Allow the persistence verification harness to redirect userData to a temp dir.
if (process.env.ALMAJD_TEST_USERDATA) {
  app.setPath("userData", process.env.ALMAJD_TEST_USERDATA);
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

function iconPath(): string {
  return path.join(__dirname, "..", "..", "build", "icon.ico");
}

function schoolDocPath(): string {
  return path.join(app.getPath("userData"), SCHOOL_DOC_FILE);
}

// Minimal valid v5 document used by the persistence verification harness.
const PERSIST_MARKER_DOC = {
  schemaVersion: 5,
  students: [
    {
      id: "persist-check-1",
      nameAr: "اختبار الحفظ عبر الملف",
      nameFr: "Test",
      klass: "الأول",
      annualFee: 0,
      gender: "male",
      placeOfBirth: "",
    },
  ],
  staff: [],
  payments: [],
  warnings: [],
  attendance: {},
  classes: [],
  subjects: [],
  terms: [],
  grades: [],
};

/**
 * Minimal static file server used in production builds.
 * Serves the pre-built SPA (index.html + hashed assets) with an
 * index.html fallback for any unknown path. Listens only on 127.0.0.1.
 */
function createStaticServer(webRoot: string): http.Server {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      let filePath = path.normalize(path.join(webRoot, decodeURIComponent(url.pathname)));
      if (!filePath.startsWith(webRoot)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      if (filePath.endsWith(path.sep) || path.extname(filePath) === "") {
        filePath = path.join(filePath, "index.html");
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        filePath = path.join(webRoot, "index.html");
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] ?? "application/octet-stream";
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    } catch (err) {
      console.error("[Al-Madjd] static server error:", err);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  });
}

function webRootForProd(): string {
  // Packaged layout: app.asar/electron/dist/main.cjs -> app.asar/desktop-web
  return path.join(__dirname, "..", "..", "desktop-web");
}

function startAppServer(): Promise<{ url: string; server: http.Server }> {
  const server = createStaticServer(webRootForProd());
  return new Promise<{ url: string; server: http.Server }>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 8081;
      resolve({ url: `http://127.0.0.1:${port}`, server });
    });
  });
}

app.setName(APP_TITLE);
app.setAppUserModelId(APP_ID);

let mainWindow: BrowserWindow | null = null;
let appServer: http.Server | null = null;

async function createWindow(): Promise<void> {
  const windowIcon = nativeImage.createFromPath(iconPath());

  mainWindow = new BrowserWindow({
    title: APP_TITLE,
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    autoHideMenuBar: true,
    backgroundColor: "#eef1f5",
    icon: windowIcon.isEmpty() ? undefined : windowIcon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // No "partition" here on purpose: the default session is persistent, so
      // Chromium localStorage lives under userData and survives restarts.
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  if (DEV_URL) {
    await mainWindow.loadURL(DEV_URL);
  } else {
    const { url, server } = await startAppServer();
    appServer = server;
    await mainWindow.loadURL(url);
  }

  if (PERSIST_TEST) {
    // Give the renderer's initDesktopSync a moment to run, then drive the
    // persistence IPC through the real preload bridge and quit with a verdict.
    setTimeout(() => {
      void runPersistTest();
    }, 3000);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function runPersistTest(): Promise<void> {
  const win = mainWindow;
  const marker = JSON.stringify(PERSIST_MARKER_DOC, null, 2);
  let result: Record<string, unknown>;
  try {
    if (!win) throw new Error("no window");
    if (PERSIST_TEST === "write") {
      result = (await win.webContents.executeJavaScript(`(async () => {
        const { writeDocument, getDocument } = window.alMajd ?? {};
        const doc = ${JSON.stringify(marker)};
        if (typeof writeDocument !== "function" || typeof getDocument !== "function") {
          return { ok: false, error: "desktop API missing" };
        }
        await writeDocument(doc);
        const back = await getDocument();
        return { ok: !!back?.exists && typeof back.content === "string" && back.content.includes("persist-check-1") };
      })()`)) as Record<string, unknown>;
    } else if (PERSIST_TEST === "read") {
      result = (await win.webContents.executeJavaScript(`(async () => {
        const back = await window.alMajd?.getDocument();
        const fileOk = !!back?.exists && typeof back.content === "string" && back.content.includes("persist-check-1");
        const hydratedInDom = document.body.innerText.includes("اختبار الحفظ عبر الملف");
        return { ok: fileOk && hydratedInDom, fileOk, hydratedInDom };
      })()`)) as Record<string, unknown>;
    } else {
      throw new Error("unknown PERSIST_TEST mode");
    }
  } catch (err) {
    result = { ok: false, error: String(err) };
  }
  console.log("PERSIST_TEST_RESULT=" + JSON.stringify(result));
  app.exit(result.ok ? 0 : 1);
}

ipcMain.handle("save-backup", async (event, payload: { content: string; defaultName: string }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options = {
    title: "حفظ النسخة الاحتياطية",
    defaultPath: payload?.defaultName || "al-majd-backup.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  };
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }
  await fs.promises.writeFile(result.filePath, payload?.content ?? "", "utf8");
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle("open-backup", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options: Electron.OpenDialogOptions = {
    title: "فتح النسخة الاحتياطية",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"],
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const filePath = result.filePaths[0];
  const content = await fs.promises.readFile(filePath, "utf8");
  return { canceled: false, content, fileName: path.basename(filePath) };
});

// --- Persistent school document (userData file) ---------------------------

ipcMain.handle("get-document", async () => {
  const filePath = schoolDocPath();
  try {
    if (fs.existsSync(filePath)) {
      const content = await fs.promises.readFile(filePath, "utf8");
      return { exists: true, content };
    }
  } catch (err) {
    console.error("[Al-Madjd] get-document failed:", err);
  }
  return { exists: false };
});

ipcMain.handle("write-document", async (_event, content: string) => {
  const filePath = schoolDocPath();
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, content ?? "", "utf8");
  return { ok: true };
});

// Synchronous flush used by the renderer's beforeunload handler so the last
// store change is never lost when the window is closed.
ipcMain.on("flush-document", (event, content: string) => {
  try {
    const filePath = schoolDocPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content ?? "", "utf8");
    event.returnValue = { ok: true };
  } catch (err) {
    console.error("[Al-Madjd] flush-document failed:", err);
    event.returnValue = { ok: false };
  }
});

app.whenReady().then(() => {
  console.log(`[Al-Madjd] userData directory: ${app.getPath("userData")}`);
  console.log(`[Al-Madjd] school document file: ${schoolDocPath()}`);
  void createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on("before-quit", () => {
  if (appServer) {
    appServer.close();
    appServer = null;
  }
});