"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function SiteMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return <main className={cn("flex-1", !isHome)}>{children}</main>;
}
