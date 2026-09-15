import { useEffect } from "react";
import { initDesktopSync } from "@/lib/desktop-sync";
import { initServerSync } from "@/lib/server-sync";

/**
 * Wires the school data layer (server document) to the store once per page.
 * Safe to call from several routes; both inits are idempotent.
 */
export function useSchoolSync() {
  useEffect(() => {
    initDesktopSync();
    void initServerSync();
  }, []);
}