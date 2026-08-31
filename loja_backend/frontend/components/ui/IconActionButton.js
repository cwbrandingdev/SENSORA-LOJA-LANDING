import Link from "next/link";
import { cn } from "@/lib/cn";

const VARIANTS = {
  default: "text-slate-500 hover:bg-slate-100 hover:text-brand-navy",
  danger: "text-slate-500 hover:bg-red-50 hover:text-red-600",
};

export default function IconActionButton({
  icon: Icon,
  label,
  onClick,
  href,
  variant = "default",
  size = 16,
  className = "",
}) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-md p-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30",
    VARIANTS[variant],
    className
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={classes}>
        <Icon size={size} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={classes}
    >
      <Icon size={size} />
    </button>
  );
}
