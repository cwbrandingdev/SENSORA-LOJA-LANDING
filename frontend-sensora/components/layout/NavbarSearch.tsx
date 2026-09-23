"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { filtrarProdutos, sugerirProdutos } from "@/lib/busca-produtos";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import type { ProdutoPublico } from "@/lib/api-publica";
import { cn } from "@/lib/utils";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const SUAVIDADE =
  "duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

let catalogoCache: Promise<ProdutoPublico[]> | null = null;

function carregarCatalogo() {
  if (!catalogoCache) {
    const base = process.env.NEXT_PUBLIC_API_URL;
    catalogoCache = base
      ? fetch(`${base}/public/produtos`)
          .then((resposta) =>
            resposta.ok ? (resposta.json() as Promise<ProdutoPublico[]>) : [],
          )
          .catch(() => [])
      : Promise.resolve([]);
  }
  return catalogoCache;
}

type NavbarSearchProps = {
  variant: "barra" | "painel";
  recolher?: boolean;
};

export default function NavbarSearch({
  variant,
  recolher = false,
}: NavbarSearchProps) {
  const [aberto, setAberto] = useState(false);
  const [query, setQuery] = useState("");
  const [produtos, setProdutos] = useState<ProdutoPublico[] | null>(null);
  const [painelPronto, setPainelPronto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const gestoAbriu = useRef(false);
  const pathname = usePathname();
  const router = useRouter();
  const listaId = useId();
  const termo = query.trim();
  const encontrados = produtos && termo ? filtrarProdutos(produtos, termo) : [];
  const sugestoes =
    produtos && termo && encontrados.length === 0
      ? sugerirProdutos(produtos, termo)
      : [];
  const mostrarPainel = aberto && termo.length > 0;

  useEffect(() => {
    setAberto(false);
    setQuery("");
  }, [pathname]);

  useEffect(() => {
    if (recolher) setAberto(false);
  }, [recolher]);

  useEffect(() => {
    if (!aberto) return;
    const foco = window.setTimeout(() => inputRef.current?.focus(), 180);
    void carregarCatalogo().then((lista) => setProdutos(lista));
    return () => window.clearTimeout(foco);
  }, [aberto]);

  useEffect(() => {
    if (!mostrarPainel) {
      setPainelPronto(false);
      return;
    }
    const quadro = requestAnimationFrame(() => setPainelPronto(true));
    return () => cancelAnimationFrame(quadro);
  }, [mostrarPainel, termo]);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (!raizRef.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  function fechar() {
    setAberto(false);
    setQuery("");
  }

  function irParaCatalogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const buscado = String(
      new FormData(event.currentTarget).get("q") ?? "",
    ).trim();
    router.push(
      buscado
        ? `${ROUTES.LOJA_PRODUTOS}?q=${encodeURIComponent(buscado)}`
        : ROUTES.LOJA_PRODUTOS,
    );
    fechar();
  }

  function aoClicarLupa() {
    if (gestoAbriu.current) {
      gestoAbriu.current = false;
      return;
    }
    if (!aberto) {
      setAberto(true);
      return;
    }
    if (!termo) fechar();
  }

  const campo = (
    <>
      <label
        htmlFor={
          variant === "barra" ? "navbar-search-desktop" : "navbar-search"
        }
        className="sr-only"
      >
        Buscar produtos
      </label>
      <input
        id={variant === "barra" ? "navbar-search-desktop" : "navbar-search"}
        ref={inputRef}
        name="q"
        type="text"
        value={query}
        onChange={(evento) => setQuery(evento.target.value)}
        placeholder="Buscar produtos"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={mostrarPainel ? listaId : undefined}
        aria-expanded={mostrarPainel}
        className={cn(
          "h-10 min-w-0 bg-transparent text-[15px] text-brand-navy outline-none placeholder:text-brand-navy/40 p-4",
          "transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          variant === "barra"
            ? aberto
              ? "w-auto flex-1 pr-1 opacity-100"
              : "w-0 flex-none p-0 opacity-0"
            : "w-full py-2",
        )}
      />
    </>
  );

  const resultados = mostrarPainel ? (
    <div
      id={listaId}
      className={cn(
        "overflow-hidden rounded-2xl border border-stone-200/80 bg-white text-brand-navy shadow-[0_16px_40px_rgba(2,24,61,0.08)]",
        "transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        painelPronto ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
        variant === "barra"
          ? "absolute top-[calc(100%+0.75rem)] right-0 z-50 w-80"
          : "mt-2",
      )}
    >
      {produtos === null ? (
        <p className="px-4 py-3 text-sm text-brand-navy/60">Buscando…</p>
      ) : encontrados.length > 0 ? (
        <ul className="max-h-80 overflow-y-auto py-1.5">
          {encontrados.slice(0, 6).map((produto) => (
            <li key={produto.id}>
              <Link
                href={LOJA_PRODUTO_URL(produto.slug)}
                onClick={fechar}
                className="flex items-center gap-3 px-3 py-2 transition-colors duration-300 hover:bg-stone-50"
              >
                {produto.imagemUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={produto.imagemUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="h-11 w-11 shrink-0 rounded-lg bg-stone-100" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {produto.nome}
                  </span>
                  {produto.aroma && (
                    <span className="block truncate text-xs text-brand-navy/55">
                      {produto.aroma}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-brand-navy/80">
                  {formatPrice.format(produto.preco)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-3.5">
          <p className="font-serif text-base text-brand-navy">
            Não achamos esse produto.
          </p>
          {sugestoes.length > 0 && (
            <>
              <p className="mt-2 text-sm text-brand-navy/70">
                Você quis dizer…?
              </p>
              <ul className="mt-2 space-y-1">
                {sugestoes.map((produto) => (
                  <li key={produto.id}>
                    <Link
                      href={LOJA_PRODUTO_URL(produto.slug)}
                      onClick={fechar}
                      className="block rounded-lg px-2 py-1.5 text-sm text-brand-navy underline-offset-4 transition-colors duration-300 hover:bg-stone-50 hover:underline"
                    >
                      {produto.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  ) : null;

  if (variant === "painel") {
    return (
      <div ref={raizRef}>
        <button
          type="button"
          onClick={() => setAberto((valor) => !valor)}
          aria-label={aberto ? "Fechar busca" : "Buscar produtos"}
          aria-expanded={aberto}
          className="inline-flex h-10 w-10 items-center justify-center text-brand-navy/70 transition-colors hover:text-brand-navy"
        >
          <Search className="h-[22px] w-[22px]" strokeWidth={1.5} />
        </button>
        <div
          className={cn(
            "fixed inset-x-0 top-14 z-40 grid bg-background transition-[grid-template-rows,opacity]",
            SUAVIDADE,
            aberto
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden border-b border-stone-200/80">
            <form
              action={ROUTES.LOJA_PRODUTOS}
              method="get"
              onSubmit={irParaCatalogo}
              className="px-4 py-3"
            >
              {campo}
            </form>
            {aberto && <div className="px-4 pb-3">{resultados}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={raizRef} className="relative">
      <form
        action={ROUTES.LOJA_PRODUTOS}
        method="get"
        onSubmit={irParaCatalogo}
        role="search"
        className={cn(
          "flex h-10 items-center overflow-hidden rounded-full transition-[width,background-color]",
          SUAVIDADE,
          aberto ? "w-60 bg-stone-100 xl:w-72" : "w-10 bg-transparent",
        )}
      >
        {campo}
        {aberto && termo && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Limpar busca"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-brand-navy/45 transition-colors hover:text-brand-navy"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        )}
        <button
          type={aberto && termo ? "submit" : "button"}
          onPointerDown={(evento) => {
            if (!aberto) {
              evento.preventDefault();
              gestoAbriu.current = true;
              setAberto(true);
            }
          }}
          onPointerUp={() => {
            window.setTimeout(() => {
              gestoAbriu.current = false;
            }, 0);
          }}
          onClick={aoClicarLupa}
          aria-label={aberto ? "Buscar produtos" : "Abrir busca"}
          aria-expanded={aberto}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-brand-navy/70 transition-colors duration-300 hover:text-brand-navy"
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </form>
      {resultados}
    </div>
  );
}
