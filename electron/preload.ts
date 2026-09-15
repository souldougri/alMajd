import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("alMajdDesktop", true);

contextBridge.exposeInMainWorld("alMajd", {
  saveBackup: (content: string, defaultName: string) =>
    ipcRenderer.invoke("save-backup", { content, defaultName }),
  openBackup: () => ipcRenderer.invoke("open-backup"),
  getDocument: () => ipcRenderer.invoke("get-document"),
  writeDocument: (content: string) => ipcRenderer.invoke("write-document", content),
  flushDocument: (content: string) => ipcRenderer.sendSync("flush-document", content),
});