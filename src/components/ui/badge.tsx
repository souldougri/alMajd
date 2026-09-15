import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  children,
}: {
  className?: string;
  tone?: "muted" | "ok" | "warn" | "bad" | "brand";
  children: ReactNode;
}) {
  const tones = {
    muted: "bg-bg-subtle text-fg-muted",
    ok: "bg-success/15 text-success",
    warn: "bg-warn/20 text-ink",
    bad: "bg-danger/10 text-danger",
    brand: "bg-primary/10 text-primary",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
