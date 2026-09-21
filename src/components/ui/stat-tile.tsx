import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  tone,
  icon: Icon,
  className,
  style,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "bad";
  icon?: LucideIcon;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("am-card p-5", className)} style={style}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-navy/55">{label}</p>
        {Icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy text-gold">
            <Icon className="size-4" strokeWidth={1.75} />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 font-display text-2xl font-bold",
          tone === "ok" ? "text-success" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-danger" : "text-navy",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-navy/50">{hint}</p> : null}
    </div>
  );
}
