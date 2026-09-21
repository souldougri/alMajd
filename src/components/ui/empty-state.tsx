import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-dashed border-navy/20 bg-white p-8 text-center",
        className,
      )}
    >
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gold/15 text-navy">
        <Icon className="size-7" strokeWidth={1.75} />
      </div>
      <h2 className="mt-4 font-display text-lg font-bold text-navy">{title}</h2>
      {body ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-navy/60">{body}</p>
      ) : null}
      {children}
    </section>
  );
}
