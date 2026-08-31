import Link from "next/link";
import { cn } from "@/lib/cn";
import Skeleton from "@/components/ui/Skeleton";

export function KpiCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-7 w-14" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}

export default function KpiCard({ icon: Icon, label, value, hint, href }) {
  const content = (
    <div
      className={cn(
        "group rounded-lg border border-slate-200 bg-white p-4 transition-colors duration-150",
        href && "hover:border-brand-navy/30 hover:bg-slate-50"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy transition-colors duration-150 group-hover:bg-brand-navy group-hover:text-white">
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 h-4 text-xs text-slate-400">{hint}</p>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30"
      >
        {content}
      </Link>
    );
  }

  return content;
}
