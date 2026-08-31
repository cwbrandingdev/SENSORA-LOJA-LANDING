"use client";

import { createContext, useContext, useState } from "react";

const AdminUIContext = createContext(undefined);

const COLLAPSE_STORAGE_KEY = "sensora_admin_sidebar_collapsed";

function readStoredCollapsed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
}

export function AdminUIProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <AdminUIContext.Provider
      value={{ mobileOpen, setMobileOpen, collapsed, toggleCollapsed }}
    >
      {children}
    </AdminUIContext.Provider>
  );
}

export function useAdminUI() {
  const context = useContext(AdminUIContext);
  if (!context) {
    throw new Error("useAdminUI deve ser usado dentro de um AdminUIProvider");
  }
  return context;
}
