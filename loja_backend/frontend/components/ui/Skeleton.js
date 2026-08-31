import { cn } from "@/lib/cn";

export default function Skeleton({ className = "" }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-200 motion-reduce:animate-none",
        className
      )}
    />
  );
}
