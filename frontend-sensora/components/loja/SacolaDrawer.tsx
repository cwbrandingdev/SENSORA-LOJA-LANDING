"use client";

// Sacola lateral: desliza da direita a cada produto adicionado (ver
// CartContext.adicionarItem) e pelo ícone de sacola do menu. Mesmo estado
// do carrinho (useCart) — a página /loja/carrinho continua existindo. Fica
// sempre montada (só desliza para fora), para a transição de CSS funcionar
// na abertura e no fechamento; fechada, vira `inert` (sem foco nem leitor
// de tela).
//
// Visual "Boutique": faixa de aviso no topo, itens em cartões brancos sobre
// fundo pedra, sugestões em carrossel com setas e rodapé com o total.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Minus, Plus, Trash2, X } from "lucide-react";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import { useCart } from "@/context/CartContext";
import { listarProdutosPublicos, type ProdutoPublico } from "@/lib/api-publica";
import { imagemKitRedimensionada } from "@/lib/loja-imagens";
import { ROUTES } from "@/lib/routes";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const MAXIMO_SUGESTOES = 8;
const semBarraDeRolagem = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function Foto({ src, nome, largura, sizes }: { src?: string; nome: string; largura: number; sizes: string }) {
  return (
    <PlaceholderImage
      src={imagemKitRedimensionada(src, largura)}
      alt={nome}
      label={nome}
      unoptimized={Boolean(src)}
      sizes={sizes}
    />
  );
}

export default function SacolaDrawer() {
  const router = useRouter();
  const {
    itens,
    totalItens,
    subtotal,
    adicionarItem,
    aumentarQuantidade,
    diminuirQuantidade,
    removerItem,
    sacolaAberta,
    fecharSacola,
  } = useCart();
  const [catalogo, setCatalogo] = useState<ProdutoPublico[] | null>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const carrossel = useRef<HTMLUListElement>(null);

  // Esc fecha; o fundo da página não rola com a sacola aberta.
  useEffect(() => {
    if (!sacolaAberta) return undefined;
    fecharRef.current?.focus();
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") fecharSacola();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [sacolaAberta, fecharSacola]);

  // Catálogo das sugestões: busca uma vez, na primeira abertura.
  useEffect(() => {
    if (!sacolaAberta || catalogo !== null) return;
    listarProdutosPublicos().then(setCatalogo);
  }, [sacolaAberta, catalogo]);

  // Outros produtos com estoque que ainda não estão na sacola.
  const sugestoes = (catalogo ?? [])
    .filter((p) => p.quantidade > 0 && !itens.some((i) => i.produtoId === p.id))
    .slice(0, MAXIMO_SUGESTOES);

  function rolarSugestoes(direcao: 1 | -1) {
    carrossel.current?.scrollBy({ left: direcao * 240, behavior: "smooth" });
  }

  function adicionarSugestao(produto: ProdutoPublico) {
    adicionarItem({
      produtoId: produto.id,
      nome: produto.nome,
      slug: produto.slug,
      imagemUrl: produto.imagemUrl,
      preco: produto.preco,
      estoqueConhecido: produto.quantidade,
    });
  }

  function finalizarCompra() {
    fecharSacola();
    // O checkout manda para o login quem ainda não entrou.
    router.push(ROUTES.LOJA_CHECKOUT);
  }

  return (
    <div
      inert={!sacolaAberta}
      className={`fixed inset-0 z-70 ${sacolaAberta ? "" : "pointer-events-none"}`}
    >
      <button
        type="button"
        aria-label="Fechar sacola"
        tabIndex={-1}
        onClick={fecharSacola}
        className={`absolute inset-0 bg-brand-navy/40 transition-opacity duration-300 motion-reduce:transition-none ${
          sacolaAberta ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="sacola-titulo"
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          sacolaAberta ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between bg-background px-6 py-4">
          <h2 id="sacola-titulo" className="text-[13px] font-semibold uppercase tracking-[0.24em] text-brand-navy">
            Sacola {totalItens > 0 && <span className="text-brand-orange">· {totalItens}</span>}
          </h2>
          <button
            ref={fecharRef}
            type="button"
            onClick={fecharSacola}
            aria-label="Fechar sacola"
            className="flex h-9 w-9 items-center justify-center text-brand-navy transition-colors hover:text-brand-orange"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </header>
        <p className="bg-brand-navy/6 px-6 py-2.5 text-center text-[13px] text-brand-navy">
          Cada pedido segue em embalagem Sensora, pronta para presentear.
        </p>

        {itens.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-stone-100 px-6 text-center">
            <p className="font-serif text-xl text-brand-navy">Sua sacola está vazia</p>
            <p className="text-sm text-slate-500">Explore a loja e encontre o aroma perfeito para o seu ambiente.</p>
            <Link
              href={ROUTES.LOJA_PRODUTOS}
              onClick={fecharSacola}
              className="mt-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-brand-orange underline underline-offset-4"
            >
              Ver produtos
            </Link>
          </div>
        ) : (
          <div className={`flex-1 overflow-y-auto bg-stone-100 ${semBarraDeRolagem}`}>
            {/* Linhas compactas (~70px): vários produtos cabem sem rolar. */}
            <ul className="space-y-2 p-3">
              {itens.map((item) => (
                <li key={item.produtoId} className="flex gap-3 bg-white p-2 shadow-sm">
                  <Link
                    href={`/loja/produtos/${item.slug}`}
                    onClick={fecharSacola}
                    className="relative aspect-square w-14 shrink-0 overflow-hidden"
                  >
                    <Foto src={item.imagemUrl} nome={item.nome} largura={140} sizes="56px" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/loja/produtos/${item.slug}`}
                        onClick={fecharSacola}
                        className="line-clamp-1 text-[14px] text-brand-navy hover:text-brand-orange"
                      >
                        {item.nome}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removerItem(item.produtoId)}
                        aria-label={`Remover "${item.nome}" da sacola`}
                        className="shrink-0 text-slate-300 transition-colors hover:text-brand-orange"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center border border-slate-200">
                        <button
                          type="button"
                          onClick={() => diminuirQuantidade(item.produtoId)}
                          disabled={item.quantidade <= 1}
                          aria-label="Diminuir quantidade"
                          className="flex h-7 w-7 items-center justify-center text-brand-navy disabled:opacity-30"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 border-x border-slate-200 text-center text-[13px] tabular-nums">{item.quantidade}</span>
                        <button
                          type="button"
                          onClick={() => aumentarQuantidade(item.produtoId)}
                          disabled={typeof item.estoqueConhecido === "number" && item.quantidade >= item.estoqueConhecido}
                          aria-label="Aumentar quantidade"
                          className="flex h-7 w-7 items-center justify-center text-brand-navy disabled:opacity-30"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-[14px] font-medium tabular-nums text-brand-navy">
                        {formatPrice.format(item.preco * item.quantidade)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {sugestoes.length > 0 && (
              <section aria-label="Sugestões" className="bg-white py-3">
                <div className="flex items-center justify-between px-6">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-navy">Aproveite e leve também</h3>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => rolarSugestoes(-1)}
                      aria-label="Sugestões anteriores"
                      className="flex h-8 w-8 items-center justify-center text-slate-400 hover:text-brand-navy"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rolarSugestoes(1)}
                      aria-label="Próximas sugestões"
                      className="flex h-8 w-8 items-center justify-center text-slate-400 hover:text-brand-navy"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <ul ref={carrossel} className={`mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 ${semBarraDeRolagem}`}>
                  {sugestoes.map((produto) => (
                    <li key={produto.id} className="flex w-56 shrink-0 snap-start items-center gap-3 border border-slate-200 p-2">
                      <div className="relative aspect-square w-12 shrink-0 overflow-hidden">
                        <Foto src={produto.imagemUrl} nome={produto.nome} largura={120} sizes="48px" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13px] leading-snug text-brand-navy">{produto.nome}</p>
                        <p className="mt-0.5 text-[13px] tabular-nums text-slate-500">{formatPrice.format(produto.preco)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => adicionarSugestao(produto)}
                        aria-label={`Adicionar "${produto.nome}" à sacola`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center bg-brand-orange text-white transition-colors hover:bg-brand-navy"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {itens.length > 0 && (
          <footer className="border-t border-slate-200 bg-background px-6 py-4">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <dt>
                  Subtotal ({totalItens} {totalItens === 1 ? "produto" : "produtos"})
                </dt>
                <dd className="tabular-nums">{formatPrice.format(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-slate-600">
                <dt>Frete</dt>
                <dd>no checkout</dd>
              </div>
              <div className="flex justify-between pt-2 text-xl font-semibold text-brand-navy">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice.format(subtotal)}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={finalizarCompra}
              className="mt-4 w-full bg-brand-navy py-3.5 text-[14px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-brand-navy-light"
            >
              Finalizar compra
            </button>
            <div className="mt-3 flex items-center justify-between text-[13px]">
              <button type="button" onClick={fecharSacola} className="text-slate-500 underline underline-offset-4 hover:text-brand-navy">
                Continuar comprando
              </button>
              <Link
                href={ROUTES.LOJA_CARRINHO}
                onClick={fecharSacola}
                className="text-slate-500 underline underline-offset-4 hover:text-brand-navy"
              >
                Ver sacola completa
              </Link>
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}
