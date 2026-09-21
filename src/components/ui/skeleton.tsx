import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("am-skeleton h-4 w-full", className)} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("am-card space-y-3 p-5", className)}>
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
