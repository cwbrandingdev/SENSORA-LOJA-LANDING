"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/lib/routes";
import { AdminUIProvider } from "@/context/AdminUIContext";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function ProtectedLayout({ children }) {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-navy motion-reduce:animate-none" />
          <p className="text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AdminUIProvider>
      <div className="flex min-h-screen flex-1 flex-col">
        <Header />
        <div className="flex flex-1 overflow-x-hidden">
          <Sidebar />
          <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AdminUIProvider>
  );
}
