"use client";

// Portado de frontend/context/AuthContext.js — mesmo comportamento exato
// (sincroniza estado a partir do token salvo, decodifica no client, expõe
// login/logout). Só tipado. NÃO plugado em nenhum layout ainda — isso é
// trabalho da próxima etapa (UI/rotas), não desta.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getRefreshToken, getToken, removeToken, syncAuthCookieFromStorage } from "@/lib/storage";
import { decodeToken, isTokenExpired } from "@/lib/jwt";
import { MARGEM_RENOVACAO_MS, renovarSessao, revogarSessaoNoServidor } from "@/lib/sessao";
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

  // Limpa a sessão local SEM navegar. Sessão vencida não é motivo para tirar
  // o visitante de uma página pública (home, loja...): o AuthProvider do
  // Navbar roda em todas as páginas do site, e redirecionar aqui mandava
  // para /login qualquer pessoa que tivesse logado há mais de 1h (validade
  // do JWT). As áreas protegidas já redirecionam sozinhas quando
  // isAuthenticated vira false (ProtectedLayout, ProtectedAccountLayout).
  function encerrarSessao() {
    limparTimerExpiracao();
    removeToken();
    setIsAuthenticated(false);
    setPerfil(null);
    setUserId(null);
    setEmail(null);
  }

  // Logout explícito (botão "Sair"): invalida o refresh token no backend,
  // limpa a sessão e leva para o login.
  function logout() {
    revogarSessaoNoServidor(getRefreshToken());
    encerrarSessao();
    router.push(ROUTES.LOGIN);
  }

  // Disparado pelo timer um pouco antes do token vencer.
  async function renovarAntesDeVencer() {
    if (await renovarSessao()) {
      sincronizarComToken();
    } else {
      encerrarSessao();
    }
  }

  async function sincronizarComToken() {
    // Token presente mas com `exp` vencido (ou não decodificável) (Task 17):
    // tenta renovar com o refresh token antes de encerrar a sessão.
    if (getToken() && isTokenExpired(getToken())) {
      const renovou = await renovarSessao();
      if (!renovou) {
        encerrarSessao();
        return;
      }
    }

    const token = getToken();
    const payload = decodeToken(token);

    setIsAuthenticated(Boolean(token));
    setPerfil(payload?.perfil ?? null);
    setUserId(payload?.sub ?? null);
    setEmail(payload?.email ?? null);
    syncAuthCookieFromStorage();

    // Agenda a renovação automática para um pouco antes do `exp` — cobre o
    // caso do usuário parado numa tela sem disparar nenhuma chamada de API
    // (a lacuna identificada na auditoria da Task 17). Se não der para
    // renovar, aí sim a sessão é encerrada.
    limparTimerExpiracao();
    if (token && payload?.exp) {
      const msAteRenovar = payload.exp * 1000 - Date.now() - MARGEM_RENOVACAO_MS;
      expiryTimerRef.current = setTimeout(renovarAntesDeVencer, Math.max(0, msAteRenovar));
    }
  }

  useEffect(() => {
    // `loading` só termina depois de uma eventual renovação — senão as
    // áreas protegidas mandariam para o login antes do token novo chegar.
    sincronizarComToken().finally(() => setLoading(false));

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
