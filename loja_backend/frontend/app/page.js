import Link from "next/link";
import Image from "next/image";
import {
  listarCategoriasPublicas,
  listarProdutosPublicos,
} from "@/lib/api-publica";
import { bannerParaCategoria } from "@/lib/loja-imagens";
import { Reveal } from "@/components/site/Reveal";
import { ProductGrid } from "@/components/loja/ProductGrid";

export const metadata = {
  title: "Loja",
};

export default async function Home() {
  const [categorias, produtos] = await Promise.all([
    listarCategoriasPublicas(),
    listarProdutosPublicos(),
  ]);

  const destaques = produtos.filter((produto) => produto.destaque);

  return (
    <div>
      <section className="relative flex h-[80vh] min-h-[520px] h-screen items-end overflow-hidden bg-brand-navy">
        <Image
          src="/loja/banners/velas.jpg"
          alt="Velas Sensora sobre madeira, luz quente"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/90 via-brand-navy/10 to-transparent" />

        <div className="relative mx-auto w-full max-w-7xl px-6 pb-16 lg:px-10">
          <Reveal>
            <h1 className="max-w-xl font-fraunces text-5xl font-light italic leading-[1.05] text-white sm:text-6xl">
              A loja Sensora
            </h1>
          </Reveal>
          <Reveal index={1}>
            <p className="mt-5 max-w-md font-inter text-[15px] text-white/80">
              Velas, difusores e sprays de ambiente.
            </p>
          </Reveal>
          <Reveal index={2}>
            <Link
              href="/loja/produtos"
              className="mt-9 inline-block border-b border-brand-orange/70 pb-1 font-inter text-[13px] uppercase tracking-[0.16em] text-white transition-colors hover:border-brand-orange"
            >
              Ver catálogo completo
            </Link>
          </Reveal>
        </div>
      </section>

      {categorias.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
          <Reveal>
            <h2 className="font-fraunces text-2xl font-light italic text-brand-navy">
              Categorias
            </h2>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categorias.map((categoria, index) => {
              const banner = bannerParaCategoria(categoria.slug);
              return (
                <Reveal key={categoria.id} index={index}>
                  <Link
                    href={`/loja/produtos?categoria=${categoria.slug}`}
                    className="group relative block aspect-[4/3] overflow-hidden bg-sensora-bg-soft"
                  >
                    {banner ? (
                      <Image
                        src={banner}
                        alt={categoria.nome}
                        fill
                        sizes="(min-width: 1024px) 33vw, 50vw"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    ) : null}
                    <div
                      className={
                        banner
                          ? "absolute inset-0 bg-gradient-to-t from-brand-navy/70 via-transparent to-transparent"
                          : "absolute inset-0"
                      }
                    />
                    <span
                      className={`absolute bottom-5 left-5 font-inter text-[13px] uppercase tracking-[0.14em] ${
                        banner ? "text-white" : "text-brand-navy"
                      }`}
                    >
                      {categoria.nome}
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>
      ) : null}

      {destaques.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">
          <Reveal>
            <h2 className="font-fraunces text-2xl font-light italic text-brand-navy">
              Em destaque
            </h2>
          </Reveal>

          <div className="mt-10">
            <ProductGrid produtos={destaques} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
