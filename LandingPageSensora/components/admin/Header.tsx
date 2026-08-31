// Portado de frontend/components/layout/Header.js — reaproveita o Logo.tsx
// canônico da Landing (public/logo.png) em vez de duplicar o asset.
import Logo from "@/components/ui/Logo";

export default function Header() {
  return (
    <header className="flex items-center justify-between bg-brand-navy px-6 py-3 text-white">
      <div className="flex items-center gap-3">
        <Logo showTagline={false} className="scale-75" />
      </div>
      <p className="text-sm text-white/80">Usuário autenticado.</p>
    </header>
  );
}
