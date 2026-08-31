import { cn } from "@/lib/cn";

const VARIANTS = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

export default function Badge({ variant = "neutral", className = "", children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
