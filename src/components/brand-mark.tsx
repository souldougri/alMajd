import { SCHOOL } from "@/lib/school";
import { cn } from "@/lib/utils";

export function SchoolSeal({ className }: { className?: string }) {
  return (
    <img
      src={SCHOOL.logo}
      alt={SCHOOL.nameAr}
      className={cn("seal size-11 rounded-full bg-surface object-cover", className)}
    />
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <SchoolSeal className={compact ? "size-10" : "size-12"} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-fg sm:text-base">{SCHOOL.nameAr}</p>
        <p className="truncate text-xs text-fg-muted">{compact ? SCHOOL.shortFr : SCHOOL.nameFr}</p>
      </div>
    </div>
  );
}
