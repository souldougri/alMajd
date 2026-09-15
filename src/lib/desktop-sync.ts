import { useSchool } from "@/lib/store";
import {
  CURRENT_SCHEMA_VERSION,
  validateBackupDocument,
  type SchoolDatabaseDocument,
} from "@/lib/storage";

/**
 * Persistence bridge for the Electron desktop build.
 *
 * The single source of truth in the packaged app is a JSON file under the
 * Electron userData directory (never inside the asar / Program Files):
 *
 *   <userData>/al-majd-school.json
 *
 * The flow:
 *   1. On startup the main process reads that file ("get-document").
 *   2. If present, the renderer validates the document with the same backup
 *      adapter (schemaVersion/migration) and hydrates the Zustand store.
 *   3. If missing, the store (already loaded from localStorage by
 *      loadSchoolDocument) is migrated to the file exactly once.
 *   4. On every store change (debounced 400ms) the full document is written
 *      back to the same file.
 *   5. A synchronous beforeunload flush guarantees the final state survives
 *      quit + relaunch.
 *
 * In the browser (window.alMajdDesktop !== true) this module is a no-op and
 * the existing localStorage autosave keeps working unchanged.
 */

const WRITE_DEBOUNCE_MS = 400;

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
  "schoolYear",
] as const;

function isDesktop(): boolean {
  return typeof window !== "undefined" && window.alMajdDesktop === true && !!window.alMajd;
}

function currentDocumentJson(): string {
  const doc: SchoolDatabaseDocument = useSchool.getState().getCurrentDocument();
  const payload: SchoolDatabaseDocument = {
    ...doc,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

let inited = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastSavedSerialized: string | null = null;

function writeNow(serialized: string): void {
  if (!isDesktop()) return;
  try {
    void window.alMajd!.writeDocument(serialized);
    lastSavedSerialized = serialized;
  } catch (err) {
    console.error("[desktop-sync] writeDocument failed:", err);
  }
}

function schedulePersist(): void {
  if (!isDesktop()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const serialized = currentDocumentJson();
    if (serialized === lastSavedSerialized) return;
    writeNow(serialized);
  }, WRITE_DEBOUNCE_MS);
}

export function initDesktopSync(): void {
  if (inited || !isDesktop()) return;
  inited = true;

  // Hydrate from the userData file; if absent, persist the current store
  // (which loadSchoolDocument already seeded from localStorage) once.
  void (async () => {
    try {
      const result = await window.alMajd!.getDocument();
      if (result?.exists && typeof result.content === "string") {
        const parsed: unknown = JSON.parse(result.content);
        const validation = validateBackupDocument(parsed);
        if (validation.success) {
          useSchool.getState().restoreFromDocument(validation.data);
        } else {
          console.error("[desktop-sync] stored document invalid:", validation.errorAr);
        }
      } else {
        writeNow(currentDocumentJson());
      }
    } catch (err) {
      console.error("[desktop-sync] hydrate failed:", err);
      writeNow(currentDocumentJson());
    }
    lastSavedSerialized = currentDocumentJson();
  })();

  // Debounced autosave on any data change (view/selection changes are ignored).
  useSchool.subscribe((state, prevState) => {
    for (const key of DATA_KEYS) {
      if (state[key] !== prevState[key]) {
        schedulePersist();
        return;
      }
    }
  });

  // Synchronous flush so the last change is never lost on quit.
  window.addEventListener("beforeunload", () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!isDesktop()) return;
    try {
      window.alMajd!.flushDocument(currentDocumentJson());
    } catch (err) {
      console.error("[desktop-sync] flush failed:", err);
    }
  });

  console.log("[desktop-sync] file persistence active for Electron.");
}