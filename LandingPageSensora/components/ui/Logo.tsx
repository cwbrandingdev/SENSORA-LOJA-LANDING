import Image from "next/image";

type LogoProps = {
  className?: string;
  showTagline?: boolean;
};

export default function Logo({ className = "", showTagline = true }: LogoProps) {
  return (
    <span className={`flex flex-col items-center leading-none ${className}`}>
      <Image src="/logo.png" alt="Sensora" width={721} height={147} priority className="h-9 w-auto" />
      {showTagline && (
        <span className="mt-4.5 text-[10px] font-medium tracking-[0.5em] text-brand-orange mr-[-0.5em]">
          MARKETING SENSORIAL
        </span>
      )}
    </span>
  );
}
