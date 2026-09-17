import { useSchool } from "@/lib/store";
import { hydrateStore, isDesktop } from "@/lib/relational";

/**
 * Bootstraps the store from the relational APIs (Step 16).
 *
 * The web build treats the PostgreSQL relational tables as the single source of
 * truth: `hydrateStore` replaces the UI cache slices from the API. Subsequent
 * writes flow through `store.syncToStorage` → `relational.pushChanges`.
 *
 * In the Electron build (window.alMajdDesktop) this module stays a no-op — the
 * desktop app persists via its own file bridge instead.
 */

let inited = false;

export async function initServerSync(): Promise<void> {
  if (inited || isDesktop()) return;
  inited = true;
  await hydrateStore((patch) => useSchool.setState(patch));
  console.log("[server-sync] relational store hydrated.");
}