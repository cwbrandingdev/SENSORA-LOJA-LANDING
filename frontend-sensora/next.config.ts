import type { NextConfig } from "next";

// Etapa 8.5 (Security Headers) — origem da API do backend (Nest), sempre
// cross-origin em relação a este frontend (deploy separado). Extraída de
// NEXT_PUBLIC_API_URL (já usada por services/api.ts e lib/api-publica.ts)
// para liberar exatamente esse host em `connect-src`, sem abrir a CSP para
// qualquer domínio. Falha de forma silenciosa (sem quebrar o build) se a
// env var estiver ausente ou malformada — nesse caso a CSP fica só com
// 'self', o que é a opção mais segura por padrão.
function obterOrigemApi(): string | null {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  try {
    return new URL(apiUrl).origin;
  } catch {
    return null;
  }
}

// Diretivas de conexão do backend próprio (fetch/axios do navegador para
// GET/POST/etc. em /produtos, /checkout, /admin/*, /imagekit/auth...).
// Asaas (Checkout hospedado) e Melhor Envio (OAuth) NUNCA entram aqui: o
// frontend só navega para eles via `window.location.assign` (ver
// services/checkout.ts e MelhorEnvioIntegracaoCard.tsx), uma navegação de
// página inteira que a CSP de `connect-src`/`default-src` não restringe —
// liberar esses domínios em connect-src seria uma permissão sem uso real.
const origemApi = obterOrigemApi();

// ImageKit: upload direto do navegador (ImageUploader.tsx faz fetch para
// upload.imagekit.io, fora do backend) e entrega das imagens dos produtos
// (<img>/<Image> apontando para ik.imagekit.io, ver components/forms/
// ImageUploader.tsx e lib/types/loja.ts). Dois hosts diferentes do mesmo
// serviço: um para enviar (connect-src), outro para exibir (img-src).
const IMAGEKIT_UPLOAD_ORIGIN = "https://upload.imagekit.io";
const IMAGEKIT_DELIVERY_ORIGIN = "https://ik.imagekit.io";

const connectSrc = ["'self'", origemApi, IMAGEKIT_UPLOAD_ORIGIN]
  .filter((origem): origem is string => Boolean(origem))
  .join(" ");

// script-src/style-src precisam de 'unsafe-inline':
// - script-src: o App Router do Next.js (RSC streaming) injeta, no HTML de
//   toda página, scripts inline `self.__next_f.push(...)` para hidratação —
//   framework, não código nosso, sem `src` para permitir hash/nonce estático.
//   CSP com nonce por requisição existe no Next.js mas exige middleware
//   gerando um valor aleatório a cada request e força todas as rotas hoje
//   estáticas (/, /velas, /loja, ...) a virarem dinâmicas — fora do escopo
//   desta etapa (headers apenas, sem tocar em middleware/rendering).
// - style-src: componentes usam `style={{ ... }}` inline (ex.: Logo.tsx —
//   crossfade de opacidade, next/font — troca de cor durante o carregamento
//   da fonte). Atributo `style=""` cai sob `style-src`, mesma exigência.
//
// 'unsafe-eval' em script-src SÓ em desenvolvimento (`next dev`): o React
// em modo dev usa eval() para reconstruir stack traces de componentes nas
// DevTools — confirmado rodando a suíte E2E completa (npm run dev) com a
// CSP sem 'unsafe-eval', que gerava o próprio erro do React explicando o
// motivo ("React will never use eval() in production mode"). O build de
// produção (`next build`/`next start`, testado via `npx next build` +
// `next start`) nunca chama eval() — mantido de fora do bundle de produção
// para não abrigar essa exceção onde ela não é necessária.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${IMAGEKIT_DELIVERY_ORIGIN}`,
  "font-src 'self'",
  `connect-src ${connectSrc}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Remove o header `X-Powered-By: Next.js` (fingerprinting desnecessário
  // da stack em produção).
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Todas as rotas (landing, loja, autenticação, /conta/**,
        // /workspace-x/** — Etapa 8.12, antes /admin/**).
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // A infraestrutura de produção (ver e2e/admin-melhor-envio.spec.ts,
          // domínio *.onrender.com) não foi confirmada como já enviando HSTS
          // por padrão (diferente da Vercel, que injeta esse header na
          // borda). Como o header é ignorado por navegadores quando recebido
          // por HTTP puro (dev local incluso), é seguro sempre declará-lo.
          // Sem `preload`: entrar na preload list do Chrome é praticamente
          // irreversível e não foi avaliado nesta etapa.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
