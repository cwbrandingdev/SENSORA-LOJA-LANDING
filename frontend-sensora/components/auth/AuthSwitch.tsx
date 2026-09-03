"use client";

// Etapa 6.2 (correção — Auth Switch real) — porte fiel do componente
// "Auth Switch" de https://21st.dev/@appvibed01/components/auth-switch
// (código-fonte obtido via mcp__21st__get_component, id 9345), adaptado à
// identidade Sensora e integrado à autenticação real do projeto.
//
// Mecânica preservada do original (não é uma reinterpretação):
//   - os dois formulários (entrar/cadastro) ficam sempre montados no DOM,
//     sobrepostos na mesma célula de um CSS Grid (.authswitch-signin-signup),
//     e alternam via opacity/z-index — não por display:none nem por
//     desmontar/montar componentes;
//   - o wrapper dos formulários se desloca horizontalmente (left: 75% ↔ 25%)
//     com "transition: 1s 0.7s ease-in-out" (delay de 0.7s no desktop);
//   - os dois painéis de marca (esquerda/direita) ficam lado a lado o tempo
//     todo; o conteúdo de cada um desliza para fora/dentro via
//     translateX(±800px) com "transition-delay: 0.6s";
//   - o efeito de "cor varrendo a tela" é um pseudo-elemento ::before —
//     um círculo gigante que translada de um lado a outro (right: 48% ↔
//     52%, transform: translate(100%, -50%)) em 1.8s, criando a ilusão de
//     um painel colorido se movendo, sem ser de fato um retângulo animado;
//   - breakpoint próprio em 870px (empilha painéis/formulário) e 570px,
//     iguais ao original — não os breakpoints padrão do Tailwind.
// Único mecanismo trocado: o círculo era dimensionado em px fixos (2000px)
// para um card fixo de 900×550 no demo original; aqui o card também é um
// card fixo (não tela cheia) com dimensões semelhantes, então os mesmos
// valores em px do original se mantêm válidos sem reajuste de escala.
//
// O que foi adaptado (conteúdo/identidade, não a mecânica):
//   - cores: roxo/gradiente do demo → Navy (#02183d) / Orange (#c45a31);
//   - ícones de emoji (📧🔒👤) → lucide-react (Mail/Lock/User), já usado
//     no projeto (ex.: app/(site)/conta/seguranca/page.tsx);
//   - ícones de login social removidos por completo (Sensora não tem essa
//     infraestrutura no backend — não inventar funcionalidade inexistente);
//   - <input type="submit"> trocados por <button type="submit"> reais
//     para suportar estado de loading/disabled;
//   - textos dos painéis reescritos para a Sensora;
//   - labels em sr-only (acessibilidade) — o original não tinha nenhum;
//   - botão de mostrar/ocultar senha, link "Esqueci minha senha" e
//     mensagens de erro/sucesso adicionados (não existiam no original,
//     exigidos pelas regras funcionais do Sensora);
//   - `inert` no formulário inativo, para tirá-lo da árvore de acessibilidade
//     e da ordem de tabulação enquanto oculto (o original não tratava isso).
//
// Autenticação: schema Zod, chamadas a login()/register() (services/auth.ts),
// AuthContext, redirecionamento por perfil e tratamento de erro são
// idênticos à Etapa 6.2 original — só a casca visual mudou.
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAxiosError } from "axios";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { login, register as registerUser } from "@/services/auth";
import { setToken } from "@/lib/storage";
import { decodeToken } from "@/lib/jwt";
import { isDestinoInternoValido } from "@/lib/auth-redirect";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/context/AuthContext";
import { PerfilUsuario } from "@/lib/types/loja";
import { cn } from "@/lib/utils";
import Logo from "@/components/ui/Logo";

export type AuthMode = "login" | "register";

export default function AuthSwitch({ initialMode }: { initialMode: AuthMode }) {
  const [isSignUp, setIsSignUp] = useState(initialMode === "register");

  return (
    <>
      <style>{AUTH_SWITCH_CSS}</style>
      <div className="authswitch-page">
        <div className={cn("authswitch-container", isSignUp && "sign-up-mode")}>
          <div className="authswitch-forms-container">
            <div className="authswitch-signin-signup">
              <SignInForm active={!isSignUp} />
              <SignUpForm
                active={isSignUp}
                onSuccess={() => setIsSignUp(false)}
              />
            </div>
          </div>

          <div className="authswitch-panels-container">
            <div className="authswitch-panel authswitch-left-panel">
              <div className="authswitch-content">
                <Logo
                  variant="light"
                  showTagline={false}
                  className="authswitch-logo"
                />
                <h3>Novo por aqui?</h3>
                <p>
                  Junte-se à Sensora e descubra uma nova forma de viver o
                  marketing sensorial.
                </p>
                <button
                  type="button"
                  className="authswitch-btn authswitch-btn-transparent"
                  onClick={() => setIsSignUp(true)}
                >
                  Criar conta
                </button>
              </div>
            </div>

            <div className="authswitch-panel authswitch-right-panel">
              <div className="authswitch-content">
                <Logo
                  variant="light"
                  showTagline={false}
                  className="authswitch-logo"
                />
                <h3>Já tem uma conta?</h3>
                <p>
                  Que bom te ver de novo. Entre para continuar sua experiência
                  Sensora.
                </p>
                <button
                  type="button"
                  className="authswitch-btn authswitch-btn-transparent"
                  onClick={() => setIsSignUp(false)}
                >
                  Entrar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Entrar — schema, submit e redirecionamento idênticos à Etapa 6.2 original.
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  senha: z
    .string()
    .min(1, "Senha é obrigatória")
    .min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function SignInForm({ active }: { active: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login: markAuthenticated } = useAuth();
  const [serverError, setServerError] = useState("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormValues) {
    setServerError("");

    try {
      const { access_token } = await login(data);
      setToken(access_token);
      markAuthenticated();

      // Task 7: se veio de um fluxo protegido (ex.: /loja/checkout), volta
      // exatamente para lá em vez do destino padrão por perfil — só quando
      // o parâmetro é um caminho interno de verdade (isDestinoInternoValido
      // recusa URL absoluta e "//host", que abririam um open redirect via
      // ?redirect=). Sem esse parâmetro, comportamento idêntico ao anterior.
      const redirectParam = searchParams.get("redirect");
      if (isDestinoInternoValido(redirectParam)) {
        router.push(redirectParam);
        return;
      }

      // Decodifica o token recém-recebido (em vez de ler `perfil` do
      // AuthContext) porque a atualização do context só se reflete no
      // próximo render — decidir o destino aqui evita depender desse
      // timing. CLIENTE vai para a loja; qualquer outro perfil (ADMIN,
      // VENDEDOR) vai para o Admin, onde o ProtectedLayout é quem valida
      // de fato o acesso.
      const perfil = decodeToken(access_token)?.perfil;
      router.push(
        perfil === PerfilUsuario.CLIENTE ? ROUTES.LOJA : ROUTES.DASHBOARD,
      );
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        setServerError("E-mail ou senha inválidos.");
      } else {
        setServerError("Não foi possível conectar ao servidor.");
      }
    }
  }

  return (
    <form
      className="authswitch-form authswitch-sign-in-form"
      onSubmit={handleSubmit(onSubmit)}
      inert={!active}
      aria-hidden={!active}
    >
      <h2 className="authswitch-title">Entrar</h2>
      <p className="authswitch-subtitle">Bem-vindo de volta à Sensora.</p>

      <div className="authswitch-field">
        <label htmlFor="login-email" className="sr-only">
          Email
        </label>
        <div
          className={cn("authswitch-input-field", errors.email && "has-error")}
        >
          <span className="authswitch-input-icon">
            <Mail className="h-[18px] w-[18px]" />
          </span>
          <input
            id="login-email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            tabIndex={active ? 0 : -1}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p id="login-email-error" className="authswitch-field-error">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="authswitch-field">
        <label htmlFor="login-senha" className="sr-only">
          Senha
        </label>
        <div
          className={cn("authswitch-input-field", errors.senha && "has-error")}
        >
          <span className="authswitch-input-icon">
            <Lock className="h-[18px] w-[18px]" />
          </span>
          <input
            id="login-senha"
            type={senhaVisivel ? "text" : "password"}
            placeholder="Senha"
            autoComplete="current-password"
            tabIndex={active ? 0 : -1}
            aria-invalid={!!errors.senha}
            aria-describedby={errors.senha ? "login-senha-error" : undefined}
            {...register("senha")}
          />
          <button
            type="button"
            className="authswitch-toggle-visibility"
            tabIndex={active ? 0 : -1}
            onClick={() => setSenhaVisivel((v) => !v)}
            aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"}
          >
            {senhaVisivel ? (
              <EyeOff className="h-[18px] w-[18px]" />
            ) : (
              <Eye className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
        {errors.senha && (
          <p id="login-senha-error" className="authswitch-field-error">
            {errors.senha.message}
          </p>
        )}
      </div>

      <div className="authswitch-forgot">
        <Link href={ROUTES.FORGOT_PASSWORD} tabIndex={active ? 0 : -1}>
          Esqueci minha senha
        </Link>
      </div>

      {serverError && (
        <p role="alert" className="authswitch-alert">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        className="authswitch-btn"
        disabled={isSubmitting}
        tabIndex={active ? 0 : -1}
      >
        {isSubmitting ? (
          <>
            <span aria-hidden className="authswitch-spinner" />
            Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Cadastro — mesmo schema/campos/serviço de app/register/page.tsx original
// (nome, email, senha). Etapa 6.3 vai auditar e evoluir essas regras; aqui
// só o container/apresentação mudou.
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  senha: z
    .string()
    .min(1, "Senha é obrigatória")
    .min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

function SignUpForm({
  active,
  onSuccess,
}: {
  active: boolean;
  onSuccess: () => void;
}) {
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterFormValues) {
    setServerError("");

    try {
      await registerUser(data);
      setSuccess(true);
      // O cadastro original redirecionava para /login após 1s. Aqui já
      // estamos na mesma experiência (Auth Switch), então só volta ao modo
      // Entrar via estado do React, sem navegar de rota (uma rota nova
      // recarregaria a página — root layouts distintos, ver topo do arquivo).
      setTimeout(onSuccess, 2200);
    } catch {
      setServerError("Não foi possível criar a conta.");
    }
  }

  return (
    <form
      className="authswitch-form authswitch-sign-up-form"
      onSubmit={handleSubmit(onSubmit)}
      inert={!active}
      aria-hidden={!active}
    >
      <h2 className="authswitch-title">Criar conta</h2>
      <p className="authswitch-subtitle">
        Leva menos de um minuto para começar.
      </p>

      <div className="authswitch-field">
        <label htmlFor="register-nome" className="sr-only">
          Nome
        </label>
        <div
          className={cn("authswitch-input-field", errors.nome && "has-error")}
        >
          <span className="authswitch-input-icon">
            <User className="h-[18px] w-[18px]" />
          </span>
          <input
            id="register-nome"
            type="text"
            placeholder="Nome"
            autoComplete="name"
            tabIndex={active ? 0 : -1}
            aria-invalid={!!errors.nome}
            aria-describedby={errors.nome ? "register-nome-error" : undefined}
            {...register("nome")}
          />
        </div>
        {errors.nome && (
          <p id="register-nome-error" className="authswitch-field-error">
            {errors.nome.message}
          </p>
        )}
      </div>

      <div className="authswitch-field">
        <label htmlFor="register-email" className="sr-only">
          Email
        </label>
        <div
          className={cn("authswitch-input-field", errors.email && "has-error")}
        >
          <span className="authswitch-input-icon">
            <Mail className="h-[18px] w-[18px]" />
          </span>
          <input
            id="register-email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            tabIndex={active ? 0 : -1}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "register-email-error" : undefined}
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p id="register-email-error" className="authswitch-field-error">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="authswitch-field">
        <label htmlFor="register-senha" className="sr-only">
          Senha
        </label>
        <div
          className={cn("authswitch-input-field", errors.senha && "has-error")}
        >
          <span className="authswitch-input-icon">
            <Lock className="h-[18px] w-[18px]" />
          </span>
          <input
            id="register-senha"
            type={senhaVisivel ? "text" : "password"}
            placeholder="Senha"
            autoComplete="new-password"
            tabIndex={active ? 0 : -1}
            aria-invalid={!!errors.senha}
            aria-describedby={errors.senha ? "register-senha-error" : undefined}
            {...register("senha")}
          />
          <button
            type="button"
            className="authswitch-toggle-visibility"
            tabIndex={active ? 0 : -1}
            onClick={() => setSenhaVisivel((v) => !v)}
            aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"}
          >
            {senhaVisivel ? (
              <EyeOff className="h-[18px] w-[18px]" />
            ) : (
              <Eye className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
        {errors.senha && (
          <p id="register-senha-error" className="authswitch-field-error">
            {errors.senha.message}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="authswitch-alert">
          {serverError}
        </p>
      )}

      {success && (
        <p role="status" className="authswitch-alert success">
          Conta criada! Enviamos um e-mail de confirmação — voltando para o
          login...
        </p>
      )}

      <button
        type="submit"
        className="authswitch-btn"
        disabled={isSubmitting || success}
        tabIndex={active ? 0 : -1}
      >
        {isSubmitting ? (
          <>
            <span aria-hidden className="authswitch-spinner" />
            Criando conta...
          </>
        ) : (
          "Criar conta"
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// CSS — porte do original (21st.dev), classes prefixadas com "authswitch-"
// para não vazar para o resto do site (o demo original usa nomes genéricos
// como ".container"/".btn", que colidiriam com o utilitário `.container` do
// próprio Tailwind). Seletores, transforms, delays e breakpoints (870px/
// 570px) mantidos como no original — só cores, textos e o que está listado
// no comentário do topo do arquivo foram adaptados.
// ---------------------------------------------------------------------------

const AUTH_SWITCH_CSS = `
.authswitch-page {
  height: 100vh;
  width: 100%;
  background: var(--background);
}

.authswitch-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #fff;
  overflow: hidden;
}

.authswitch-forms-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

.authswitch-signin-signup {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  left: 75%;
  width: 50%;
  transition: 1s 0.7s ease-in-out;
  display: grid;
  grid-template-columns: 1fr;
  z-index: 5;
}

.authswitch-form {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  flex-direction: column;
  padding: 0 5rem;
  transition: all 0.2s 0.7s;
  overflow: hidden;
  grid-column: 1 / 2;
  grid-row: 1 / 2;
  width: 100%;
}

.authswitch-sign-up-form {
  opacity: 0;
  z-index: 1;
  pointer-events: none;
  /* O wrapper .signin-signup inteiro se desloca (left:75%↔25%) — quando
     este formulário fica visível, o wrapper está do lado esquerdo, então a
     borda perto do divisor/painel azul é a direita. Espelha o alinhamento
     do formulário de login (que por padrão já fica perto do azul do lado
     dele) para "Criar conta" ficar igual, perto do azul, no lado dele. */
  align-items: flex-end;
}

.authswitch-sign-in-form {
  z-index: 2;
}

.authswitch-title {
  font-size: 2.25rem;
  color: var(--brand-navy);
  margin-bottom: 0.4rem;
  font-weight: 700;
  width: 100%;
  max-width: 420px;
}

.authswitch-subtitle {
  font-size: 1rem;
  color: #6b7280;
  margin-bottom: 1.75rem;
  width: 100%;
  max-width: 420px;
}

.authswitch-field {
  width: 100%;
  max-width: 420px;
  margin: 0.6rem 0;
}

.authswitch-input-field {
  width: 100%;
  background-color: #f4f2ec;
  height: 58px;
  border-radius: 58px;
  display: grid;
  grid-template-columns: 15% 85%;
  padding: 0 0.35rem;
  position: relative;
  transition: 0.3s;
}

.authswitch-input-field:focus-within {
  background-color: #ece9e0;
  box-shadow: 0 0 0 2px var(--brand-navy);
}

.authswitch-input-field.has-error {
  box-shadow: 0 0 0 2px #f87171;
}

.authswitch-input-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8a8a8a;
}

.authswitch-input-field input {
  background: none;
  outline: none;
  border: none;
  font-weight: 500;
  font-size: 1rem;
  color: var(--brand-navy);
  width: 100%;
  padding-right: 2rem;
}

.authswitch-input-field input::placeholder {
  color: #a3a3a3;
  font-weight: 400;
}

/* Achado do bug do quadrado azul: o autofill nativo do Chrome pinta o
   <input> com um "-webkit-box-shadow: 0 0 0 1000px <azul claro> inset"
   próprio do navegador, que nenhuma propriedade de background/CSS normal
   consegue sobrescrever — só um box-shadow inset mais específico. Como
   ".authswitch-input-field" é um grid de duas colunas (15% ícone / 85%
   input) com fundo #f4f2ec, o autofill acaba pintando só a coluna do
   input, criando o retângulo azul de duas cores visto no bug. Força o
   inset a usar a MESMA cor de fundo do pill (dois valores, um por estado,
   já que o wrapper muda de cor em :focus-within) — a transição gigante em
   background-color é o truque padrão para o Chrome não "piscar" o azul
   nativo antes de aplicar o override. */
.authswitch-input-field input:-webkit-autofill,
.authswitch-input-field input:-webkit-autofill:hover,
.authswitch-input-field input:-webkit-autofill:active {
  -webkit-text-fill-color: var(--brand-navy);
  -webkit-box-shadow: 0 0 0px 1000px #f4f2ec inset;
  box-shadow: 0 0 0px 1000px #f4f2ec inset;
  transition: background-color 5000s ease-in-out 0s;
}
.authswitch-input-field input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--brand-navy);
  -webkit-box-shadow: 0 0 0px 1000px #ece9e0 inset;
  box-shadow: 0 0 0px 1000px #ece9e0 inset;
  transition: background-color 5000s ease-in-out 0s;
}

.authswitch-toggle-visibility {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
}
.authswitch-toggle-visibility:hover {
  color: var(--brand-navy);
}

.authswitch-field-error {
  font-size: 0.75rem;
  color: #dc2626;
  margin-top: 0.3rem;
  margin-left: 0.85rem;
}

.authswitch-forgot {
  width: 100%;
  max-width: 420px;
  text-align: right;
  margin: -0.15rem 0 0.4rem;
}
.authswitch-forgot a {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--brand-navy);
}
.authswitch-forgot a:hover {
  color: var(--brand-orange);
  text-decoration: underline;
}

.authswitch-btn {
  width: 100%;
  max-width: 420px;
  background-color: var(--brand-navy);
  border: none;
  outline: none;
  height: 54px;
  border-radius: 54px;
  color: #fff;
  font-weight: 600;
  margin: 0.75rem 0 0.4rem;
  cursor: pointer;
  transition: 0.3s;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.authswitch-btn:hover:not(:disabled) {
  background-color: var(--brand-navy-light);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(2, 24, 61, 0.25);
}
.authswitch-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.authswitch-spinner {
  height: 0.9rem;
  width: 0.9rem;
  border-radius: 9999px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  animation: authswitch-spin 0.6s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .authswitch-spinner {
    animation-duration: 1.4s;
  }
}
@keyframes authswitch-spin {
  to {
    transform: rotate(360deg);
  }
}

.authswitch-alert {
  width: 100%;
  max-width: 420px;
  border-radius: 10px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  padding: 0.6rem 0.9rem;
  font-size: 0.85rem;
  margin: 0.35rem 0;
}
.authswitch-alert.success {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #15803d;
}

.authswitch-logo {
  margin-bottom: 0.5rem;
}

.authswitch-panels-container {
  position: absolute;
  height: 100%;
  width: 100%;
  top: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.authswitch-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-around;
  text-align: center;
  z-index: 6;
}

.authswitch-left-panel {
  pointer-events: all;
  padding: 3rem 17% 2rem 12%;
}

.authswitch-right-panel {
  pointer-events: none;
  padding: 3rem 12% 2rem 17%;
  /* Espelha o painel esquerdo: sem isso, align-items:flex-end (herdado de
     .authswitch-panel) empurra o conteúdo para a borda externa em vez da
     borda interna (perto do divisor), ficando inconsistente com o painel
     esquerdo — que já hugueia o divisor por padrão. */
  align-items: flex-start;
}

.authswitch-content {
  color: #fff;
  transition: transform 0.9s ease-in-out;
  transition-delay: 0.6s;
}

.authswitch-content h3 {
  font-weight: 600;
  line-height: 1.15;
  font-size: 1.4rem;
  margin-bottom: 0.6rem;
  margin-top: 0.5rem;
}

.authswitch-content p {
  font-size: 0.9rem;
  padding: 0.4rem 0 1rem;
  color: rgba(255, 255, 255, 0.85);
}

.authswitch-btn-transparent {
  margin: 0;
  background: none;
  border: 2px solid #fff;
  width: 150px;
  height: 42px;
  font-weight: 600;
  font-size: 0.8rem;
  color: #fff;
}
.authswitch-btn-transparent:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--brand-orange);
  transform: translateY(-2px);
  box-shadow: none;
}

.authswitch-right-panel .authswitch-content {
  transform: translateX(800px);
}

.authswitch-container.sign-up-mode::before {
  transform: translate(100%, -50%);
  right: 52%;
}

.authswitch-container.sign-up-mode .authswitch-left-panel .authswitch-content {
  transform: translateX(-800px);
}

.authswitch-container.sign-up-mode .authswitch-signin-signup {
  left: 25%;
}

.authswitch-container.sign-up-mode .authswitch-sign-up-form {
  opacity: 1;
  z-index: 2;
  pointer-events: auto;
}

.authswitch-container.sign-up-mode .authswitch-sign-in-form {
  opacity: 0;
  z-index: 1;
  pointer-events: none;
}

.authswitch-container.sign-up-mode .authswitch-right-panel .authswitch-content {
  transform: translateX(0%);
}

.authswitch-container.sign-up-mode .authswitch-left-panel {
  pointer-events: none;
}

.authswitch-container.sign-up-mode .authswitch-right-panel {
  pointer-events: all;
}

.authswitch-container::before {
  content: "";
  position: absolute;
  height: 220vmax;
  width: 220vmax;
  top: -10%;
  right: 48%;
  transform: translateY(-50%);
  background: linear-gradient(-45deg, var(--brand-navy) 0%, var(--brand-navy-light) 100%);
  transition: 1.8s ease-in-out;
  border-radius: 50%;
  z-index: 6;
}

@media (prefers-reduced-motion: reduce) {
  .authswitch-signin-signup,
  .authswitch-content,
  .authswitch-container::before {
    transition-duration: 0.01ms !important;
    transition-delay: 0s !important;
  }
}

@media (max-width: 870px) {
  .authswitch-signin-signup {
    width: 100%;
    top: 95%;
    transform: translate(-50%, -100%);
    transition: 1s 0.8s ease-in-out;
  }
  /* No mobile o formulário ocupa a largura toda e não há mais painel azul
     do lado — os dois formulários voltam a alinhar à esquerda, como o
     resto dos formulários do Sensora. */
  .authswitch-sign-up-form {
    align-items: flex-start;
  }
  .authswitch-signin-signup,
  .authswitch-container.sign-up-mode .authswitch-signin-signup {
    left: 50%;
  }
  .authswitch-panels-container {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 2fr 1fr;
  }
  .authswitch-panel {
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
    padding: 2rem 8%;
    grid-column: 1 / 2;
  }
  .authswitch-right-panel {
    grid-row: 3 / 4;
  }
  .authswitch-left-panel {
    grid-row: 1 / 2;
  }
  .authswitch-content {
    padding-right: 0;
    transition: transform 0.9s ease-in-out;
    transition-delay: 0.8s;
  }
  .authswitch-logo {
    display: none;
  }
  .authswitch-content h3 {
    font-size: 1.05rem;
  }
  .authswitch-content p {
    font-size: 0.72rem;
    padding: 0.35rem 0;
  }
  .authswitch-btn-transparent {
    width: 120px;
    height: 36px;
    font-size: 0.7rem;
  }

  .authswitch-container::before {
    width: 180vmax;
    height: 180vmax;
    transform: translateX(-50%);
    left: 30%;
    bottom: 68%;
    right: initial;
    top: initial;
    transition: 2s ease-in-out;
  }
  .authswitch-container.sign-up-mode::before {
    transform: translate(-50%, 100%);
    bottom: 32%;
    right: initial;
  }
  .authswitch-container.sign-up-mode .authswitch-left-panel .authswitch-content {
    transform: translateY(-300px);
  }
  .authswitch-container.sign-up-mode .authswitch-right-panel .authswitch-content {
    transform: translateY(0px);
  }
  .authswitch-right-panel .authswitch-content {
    transform: translateY(300px);
  }
  .authswitch-container.sign-up-mode .authswitch-signin-signup {
    top: 5%;
    transform: translate(-50%, 0);
  }
}

@media (max-width: 570px) {
  .authswitch-form {
    padding: 0 1.25rem;
  }
  .authswitch-content {
    padding: 0.5rem 1rem;
  }
}
`;
