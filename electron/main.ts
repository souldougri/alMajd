import { app, BrowserWindow, dialog, nativeImage, shell } from "electron";
import * as path from "node:path";

const APP_ID = "com.almadjd.sis";
const APP_TITLE = "نظام إدارة مجمع المجد التعليمي العربي";
const WEB_URL = "https://almadjdapp.vercel.app/";
const DEV_URL = process.env.ELECTRON_START_URL;

const ALLOWED_ORIGINS = [
  "https://almadjdapp.vercel.app",
];

function iconPath(): string {
  return path.join(__dirname, "..", "..", "build", "icon.ico");
}

app.setName(APP_TITLE);
app.setAppUserModelId(APP_ID);

let mainWindow: BrowserWindow | null = null;

function isAllowedOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_ORIGINS.some((origin) => parsed.origin === origin);
  } catch {
    return false;
  }
}

let connectionErrorShown = false;

function registerNavigationHandlers(win: BrowserWindow): void {
  const { webContents } = win;

  webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedOrigin(url)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  webContents.on("will-navigate", (event, url) => {
    if (isAllowedOrigin(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    if (errorCode === -3) return;
    console.error(`[Al-Majd] load failed (${errorCode}): ${errorDescription}`);
    if (connectionErrorShown) return;
    connectionErrorShown = true;
    const msg =
      "تعذر الاتصال بالخادم.\n\nيرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.\n\n" +
      `(${errorDescription})`;
    dialog.showErrorBox("خطأ في الاتصال", msg);
  });
}

function registerDownloadHandler(win: BrowserWindow): void {
  win.webContents.session.on("will-download", (_event, item) => {
    const downloadsPath = app.getPath("downloads");
    item.setSavePath(path.join(downloadsPath, item.getFilename()));
  });
}

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
    },
  });

  registerNavigationHandlers(mainWindow);
  registerDownloadHandler(mainWindow);

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  const targetUrl = DEV_URL || WEB_URL;
  await mainWindow.loadURL(targetUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log(`[Al-Majd] Starting — target: ${DEV_URL || WEB_URL}`);
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
