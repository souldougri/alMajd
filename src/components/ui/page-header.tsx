import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function PageHeader({
  backTo,
  backLabel,
  title,
  subtitle,
  actions,
}: {
  backTo?: string;
  backLabel?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {backTo && backLabel ? (
          <Link to={backTo} className="text-sm text-navy/55 transition-colors hover:text-gold">
            → {backLabel}
          </Link>
        ) : null}
        <h1 className="mt-1 font-display text-2xl font-bold text-navy sm:text-3xl">{title}</h1>
        {subtitle ? <p className="text-sm text-navy/55">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
