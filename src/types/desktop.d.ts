export {};

declare global {
  interface Window {
    alMajdDesktop?: boolean;
    alMajd?: {
      saveBackup(content: string, defaultName: string): Promise<{ canceled: boolean; filePath?: string }>;
      openBackup(): Promise<{ canceled: boolean; content?: string; fileName?: string }>;
      getDocument(): Promise<{ exists: boolean; content?: string }>;
      writeDocument(content: string): Promise<{ ok: boolean }>;
      flushDocument(content: string): { ok: boolean };
    };
  }
}