"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, removeToken } from "@/lib/storage";
import { decodeToken } from "@/lib/jwt";
import { ROUTES } from "@/lib/routes";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState(null);
  const [userId, setUserId] = useState(null);

  function sincronizarComToken() {
    const token = getToken();
    const payload = decodeToken(token);

    setIsAuthenticated(Boolean(token));
    setPerfil(payload?.perfil ?? null);
    setUserId(payload?.sub ?? null);
  }

  useEffect(() => {
    sincronizarComToken();
    setLoading(false);
  }, []);

  function login() {
    sincronizarComToken();
  }

  function logout() {
    removeToken();
    setIsAuthenticated(false);
    setPerfil(null);
    setUserId(null);
    router.push(ROUTES.LOGIN);
  }

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, loading, perfil, userId, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
