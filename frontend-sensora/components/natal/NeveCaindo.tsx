"use client";

import { useEffect, useRef } from "react";

// Neve leve caindo por cima do elemento pai (que precisa ser `relative`),
// ou da tela inteira com `fixo` (tema do site todo, por baixo do menu).
// Canvas sem dependências; não bloqueia cliques e não roda para quem pediu
// menos movimento no sistema.
type Floco = { x: number; y: number; raio: number; velocidade: number; deriva: number; fase: number };

type Props = { fixo?: boolean; quantidade?: number };

export default function NeveCaindo({ fixo = false, quantidade = 70 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let largura = 0;
    let altura = 0;
    function ajustarTamanho() {
      const escala = window.devicePixelRatio || 1;
      largura = canvas!.clientWidth;
      altura = canvas!.clientHeight;
      canvas!.width = largura * escala;
      canvas!.height = altura * escala;
      ctx!.setTransform(escala, 0, 0, escala, 0, 0);
    }
    ajustarTamanho();

    const flocos: Floco[] = Array.from({ length: quantidade }, () => ({
      x: Math.random() * largura,
      y: Math.random() * altura,
      raio: 1 + Math.random() * 2.2,
      velocidade: 0.3 + Math.random() * 0.8,
      deriva: 0.3 + Math.random() * 0.6,
      fase: Math.random() * Math.PI * 2,
    }));

    let quadro = 0;
    function desenhar() {
      ctx!.clearRect(0, 0, largura, altura);
      // Sombra azul leve: o floco branco aparece também no fundo creme.
      ctx!.shadowColor = "rgba(2, 24, 61, 0.35)";
      ctx!.shadowBlur = 3;
      for (const floco of flocos) {
        floco.fase += 0.01;
        floco.y += floco.velocidade;
        floco.x += Math.sin(floco.fase) * floco.deriva;
        if (floco.y > altura + 5) {
          floco.y = -5;
          floco.x = Math.random() * largura;
        }
        ctx!.beginPath();
        ctx!.arc(floco.x, floco.y, floco.raio, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 255, 255, ${0.35 + floco.raio / 6})`;
        ctx!.fill();
      }
      quadro = requestAnimationFrame(desenhar);
    }
    desenhar();

    window.addEventListener("resize", ajustarTamanho);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", ajustarTamanho);
    };
  }, [quantidade]);

  const posicao = fixo ? "fixed inset-0 z-40" : "absolute inset-0 z-10";
  return <canvas ref={canvasRef} aria-hidden className={`pointer-events-none h-full w-full ${posicao}`} />;
}
