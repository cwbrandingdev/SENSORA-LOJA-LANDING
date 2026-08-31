"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

const LINKS = [
  { href: "/loja", label: "Início" },
  { href: "/loja/produtos", label: "Catálogo" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-brand-navy font-inter text-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link href="/loja" className="relative h-6 w-28 shrink-0" aria-label="Sensora — início">
          <Image
            src="/brand/logo.png"
            alt="Sensora"
            fill
            className="object-contain object-left"
            priority
          />
        </Link>

        <nav className="hidden gap-8 text-[13px] uppercase tracking-[0.14em] sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-white/80 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-col gap-1.5 sm:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
        >
          <span
            className={`h-px w-6 bg-white transition-transform ${open ? "translate-y-[3px] rotate-45" : ""}`}
          />
          <span
            className={`h-px w-6 bg-white transition-transform ${open ? "-translate-y-[3px] -rotate-45" : ""}`}
          />
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden sm:hidden"
          >
            <div className="flex flex-col gap-4 px-6 pb-6 text-[13px] uppercase tracking-[0.14em]">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-white/80 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
