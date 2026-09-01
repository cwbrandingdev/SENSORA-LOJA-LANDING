"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function useNavbarScroll() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [progress, setProgress] = useState(isHome ? 0 : 1);

  useEffect(() => {
    if (!isHome) {
      setProgress(1);
      return undefined;
    }

    const update = () => {
      const heroHeight = window.innerHeight;
      const start = heroHeight * 0.55;
      const end = heroHeight * 0.92;
      const next = Math.min(1, Math.max(0, (window.scrollY - start) / (end - start)));
      setProgress(next);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isHome]);

  return { progress, isHome, isBright: progress >= 0.5 };
}
