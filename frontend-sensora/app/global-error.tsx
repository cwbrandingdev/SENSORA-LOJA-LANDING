"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Erro que derrubou o layout raiz: envia ao Sentry (ver lib/sentry.ts) e
// mostra uma página mínima. Substitui o layout inteiro, então não tem os
// estilos globais — só estilo inline.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <title>Algo deu errado — Sensora</title>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 400 }}>
          Algo deu errado.
        </h1>
        <p>Tente novamente em instantes.</p>
        <button
          type="button"
          onClick={() => retry()}
          style={{ padding: "0.75rem 1.5rem", cursor: "pointer" }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
