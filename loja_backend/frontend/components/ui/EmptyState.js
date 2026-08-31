import { cn } from "@/lib/cn";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white px-6 py-12 text-center",
        className
      )}
    >
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon size={22} />
        </span>
      )}
      {title && <p className="text-sm font-medium text-slate-700">{title}</p>}
      {description && (
        <p className="max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
