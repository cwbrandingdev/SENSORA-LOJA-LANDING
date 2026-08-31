import Image from "next/image";

export default function Logo({ className = "" }) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Sensora"
      width={721}
      height={147}
      className={className}
    />
  );
}
