import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  showTagline?: boolean;
  /** `light` = white logo for dark backgrounds; `dark` = navy logo for bright backgrounds */
  variant?: "light" | "dark";
  style?: CSSProperties;
};

const LOGO_SOURCES = {
  light: "/logo.png",
  dark: "/logo-escura.png",
} as const;

export default function Logo({
  className = "",
  showTagline = true,
  variant = "light",
  style,
}: LogoProps) {
  return (
    <span
      className={cn("flex flex-col items-center leading-none", className)}
      style={style}
    >
      <Image
        src={LOGO_SOURCES[variant]}
        alt="Sensora"
        width={250}
        height={50}
        priority
      />
      {showTagline && (
        <span className="mt-4.5 mr-[-0.5em] text-[10px] font-medium tracking-[0.5em] text-brand-orange">
          MARKETING SENSORIAL
        </span>
      )}
    </span>
  );
}

type LogoSwapProps = {
  className?: string;
  showTagline?: boolean;
  progress: number;
};

export function LogoSwap({
  className = "",
  showTagline = false,
  progress,
}: LogoSwapProps) {
  return (
    <span
      className={cn(
        "relative inline-flex flex-col items-center leading-none",
        className,
      )}
    >
      <span className="relative inline-block">
        <Logo
          variant="light"
          showTagline={false}
          className={cn(progress >= 1 && "invisible")}
          style={{ opacity: 1 - progress }}
        />
        <Logo
          variant="dark"
          showTagline={false}
          className="absolute left-0 top-0"
          style={{ opacity: progress }}
        />
      </span>
      {showTagline && (
        <span className="mt-4.5 mr-[-0.5em] text-[10px] font-medium tracking-[0.5em] text-brand-orange">
          MARKETING SENSORIAL
        </span>
      )}
    </span>
  );
}
