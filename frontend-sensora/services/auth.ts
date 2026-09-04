// Portado de frontend/services/auth.js.
// register() retorna o usuário criado (UsuarioPublico), não um token —
// conferido em backend/src/auth/auth.service.ts: o registro não autentica
// automaticamente, só cria o usuário com perfil CLIENTE.
import api from "./api";
import type {
  AuthResponse,
  ForgotPasswordPayload,
  LoginPayload,
  MessageResponse,
  RegisterPayload,
  ResendVerificationPayload,
  ResetPasswordPayload,
  Usuario,
  VerifyEmailPayload,
} from "@/lib/types/loja";

export async function login(data: LoginPayload): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/login", data);
  return response.data;
}

export async function register(data: RegisterPayload): Promise<Usuario> {
  const response = await api.post<Usuario>("/auth/register", data);
  return response.data;
}

// Etapa 6.4 (Confirmação de e-mail) — espelham POST /auth/verify-email e
// POST /auth/resend-verification (backend/src/auth/auth.controller.ts).
export async function verifyEmail(data: VerifyEmailPayload): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>("/auth/verify-email", data);
  return response.data;
}

export async function resendVerification(
  data: ResendVerificationPayload,
): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>("/auth/resend-verification", data);
  return response.data;
}

// Etapa 8.0 (Finalização do e-mail/Resend) — espelham POST
// /auth/forgot-password e POST /auth/reset-password
// (backend/src/auth/auth.controller.ts). Resposta sempre genérica
// (AuthService anti-enumeração) — nunca revela se o e-mail existe.
export async function forgotPassword(
  data: ForgotPasswordPayload,
): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>("/auth/forgot-password", data);
  return response.data;
}

export async function resetPassword(
  data: ResetPasswordPayload,
): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>("/auth/reset-password", data);
  return response.data;
}
