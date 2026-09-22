"use client";

import { openCookiePreferences } from "@/lib/cookieConsent";

const linkClass =
  "group relative inline-block w-full text-left transition-colors duration-300 hover:text-white sm:w-auto";

export default function CookiePreferencesTrigger() {
  return (
    <button
      type="button"
      onClick={() => openCookiePreferences()}
      className={linkClass}
    >
      Preferências de cookies
      <span
        aria-hidden
        className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
      />
    </button>
  );
}
