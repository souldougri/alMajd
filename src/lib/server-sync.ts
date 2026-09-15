import { useSchool } from "@/lib/store";
import { api } from "@/lib/api";
import { validateBackupDocument, type SchoolDatabaseDocument } from "@/lib/storage";

/**
 * Server persistence for the school data document.
 *
 * The Zustand store remains the UI cache; the single source of truth for the
 * web build is the versioned JSON document stored server-side (PostgreSQL or
 * PGLite under .data/). localStorage keeps working as an import/fallback
 * source: if the server has no document yet, whatever the client loaded
 * (including a previously saved localStorage backup) is pushed once.
 *
 * In the Electron build (window.alMajdDesktop) this module stays a no-op —
 * the desktop app persists via its own file bridge instead.
 */

const DATA_KEYS = [
  "students",
  "classes",
  "subjects",
  "terms",
  "grades",
  "staff",
  "payments",
  "warnings",
  "attendance",
  "feeTypes",
  "expenses",
  "examSessions",
  "timetable",
  "publishedResults",
  "schoolYear",
] as const;

const SAVE_DEBOUNCE_MS = 600;

let inited = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let saving = false;
let pendingAfterSave = false;

function isDesktop(): boolean {
  return typeof window !== "undefined" && window.alMajdDesktop === true;
}

async function putDocument(): Promise<boolean> {
  const doc = useSchool.getState().getCurrentDocument();
  const res = await api.put<{ saved: boolean }>("/api/school", { document: doc });
  if (!res.ok) {
    console.error("[server-sync] save failed:", res.error);
    return false;
  }
  return true;
}

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (saving) {
    pendingAfterSave = true;
    return;
  }
  saving = true;
  try {
    await putDocument();
  } finally {
    saving = false;
    if (pendingAfterSave) {
      pendingAfterSave = false;
      void flush();
    }
  }
}

function scheduleSave(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Hydrates the store from the server document (or pushes the local backup to
 * an empty server) and wires a debounced save on every data mutation.
 */
export async function initServerSync(): Promise<void> {
  if (inited || isDesktop()) return;
  inited = true;

  try {
    const res = await api.get<{ exists: boolean; schemaVersion?: number; document?: SchoolDatabaseDocument }>(
      "/api/school",
    );
    if (res.ok && res.data?.exists && res.data.document) {
      const validation = validateBackupDocument(res.data.document);
      if (validation.success) {
        useSchool.getState().restoreFromDocument(validation.data);
      } else {
        console.error("[server-sync] stored document invalid:", validation.errorAr);
      }
    } else {
      // No server document yet: seed it with whatever is loaded locally
      // (this also imports a pre-existing localStorage backup exactly once).
      await putDocument();
    }
  } catch (err) {
    console.error("[server-sync] hydrate failed:", err);
  }

  useSchool.subscribe((state, prevState) => {
    for (const key of DATA_KEYS) {
      if (state[key] !== prevState[key]) {
        scheduleSave();
        return;
      }
    }
  });

  if (typeof window !== "undefined" && window.alMajdDesktop === true) return;
  console.log("[server-sync] server persistence active.");
}