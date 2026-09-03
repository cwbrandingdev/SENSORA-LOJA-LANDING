"use client";

// Portado de frontend/context/AuthContext.js — mesmo comportamento exato
// (sincroniza estado a partir do token salvo, decodifica no client, expõe
// login/logout). Só tipado. NÃO plugado em nenhum layout ainda — isso é
// trabalho da próxima etapa (UI/rotas), não desta.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getToken, removeToken } from "@/lib/storage";
import { decodeToken, isTokenExpired } from "@/lib/jwt";
import { ROUTES } from "@/lib/routes";
import type { PerfilUsuario } from "@/lib/types/loja";

type AuthContextValue = {
  isAuthenticated: boolean;
  loading: boolean;
  perfil: PerfilUsuario | null;
  userId: number | null;
  // Etapa 6.6 (Dashboard Admin) — já vinha decodificado do token em
  // sincronizarComToken(), só não era exposto a quem consome o contexto.
  // Usado pelo Header do Admin para identificar o usuário logado sem
  // precisar de uma chamada nova a GET /usuarios/me (o JWT não carrega
  // `nome`, só `email`/`perfil`/`sub`).
  email: string | null;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function limparTimerExpiracao() {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }

  function logout() {
    limparTimerExpiracao();
    removeToken();
    setIsAuthenticated(false);
    setPerfil(null);
    setUserId(null);
    setEmail(null);
    router.push(ROUTES.LOGIN);
  }

  function sincronizarComToken() {
    const token = getToken();

    // Token presente mas com `exp` vencido (ou não decodificável) — mesmo
    // caminho do 401 do interceptor: reaproveita logout() para não duplicar
    // a limpeza de sessão/redirect (Task 17).
    if (token && isTokenExpired(token)) {
      logout();
      return;
    }

    const payload = decodeToken(token);

    setIsAuthenticated(Boolean(token));
    setPerfil(payload?.perfil ?? null);
    setUserId(payload?.sub ?? null);
    setEmail(payload?.email ?? null);

    // Agenda o logout automático para o instante exato do `exp` — cobre o
    // caso do usuário parado numa tela sem disparar nenhuma chamada de API
    // (a lacuna identificada na auditoria da Task 17).
    limparTimerExpiracao();
    if (token && payload?.exp) {
      const msRestantes = payload.exp * 1000 - Date.now();
      expiryTimerRef.current = setTimeout(logout, msRestantes);
    }
  }

  useEffect(() => {
    sincronizarComToken();
    setLoading(false);

    return () => {
      limparTimerExpiracao();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function login() {
    sincronizarComToken();
  }

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, loading, perfil, userId, email, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
