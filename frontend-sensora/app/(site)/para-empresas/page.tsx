import type { Metadata } from "next";
import FormularioProposta from "@/components/empresas/FormularioProposta";
import FotoAmostra from "@/components/empresas/FotoAmostra";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { PEDIDO_MINIMO_EMPRESAS } from "@/lib/propostas-empresas";

export const metadata: Metadata = {
  title: "Para empresas",
  description:
    "Presentes sensoriais personalizados com a sua marca: velas, sprays, difusores e kits para colaboradores, clientes e eventos. Pedidos a partir de 30 unidades.",
};

const PRODUTOS = [
  {
    nome: "Velas aromáticas",
    texto:
      "Rótulo e embalagem com a sua marca, na fragrância que combina com a ocasião.",
    imagem: "/images/categories/velas-aromaticas.webp",
  },
  {
    nome: "Sprays de ambiente",
    texto:
      "Um presente prático, para usar todos os dias e lembrar de quem presenteou.",
    imagem: "/images/categories/sprays-de-ambiente.jpg",
  },
  {
    nome: "Difusores",
    texto:
      "Perfume contínuo para casa ou escritório, com acabamento personalizado.",
    imagem: "/images/categories/difusores-de-aroma.jpg",
  },
  {
    nome: "Kits presenteáveis",
    texto: "Combinações montadas para o seu público, prontas para entregar.",
    imagem: "/images/categories/kits-4-estacoes.jpg",
  },
];

const DEPOIS_DO_ENVIO = [
  "Recebemos o seu pedido",
  "Retornamos com sugestões",
  "Você aprova a proposta final",
];

const MOTIVOS = [
  {
    titulo: "Memória de marca",
    texto:
      "O olfato é o sentido mais ligado à memória. Um aroma faz a sua marca ser lembrada muito depois da entrega.",
  },
  {
    titulo: "Presente que é usado",
    texto:
      "Vela, spray ou difusor ficam à vista e em uso — longe da gaveta onde vão os brindes de catálogo.",
  },
  {
    titulo: "Experiência completa",
    texto:
      "Embalagem, rótulo e fragrância pensados juntos, para o presente chegar com a cara da sua empresa.",
  },
  {
    titulo: "Cera vegetal",
    texto:
      "Velas em cera de coco 100% vegetal, livres de parafina — um cuidado que a sua marca também assina.",
  },
];

const PASSOS = [
  {
    titulo: "Conversa",
    texto: "Entendemos a ocasião, o público, a quantidade e o prazo.",
  },
  {
    titulo: "Proposta",
    texto:
      "Sugerimos produtos, fragrâncias e personalização para a sua aprovação.",
  },
  {
    titulo: "Produção",
    texto: "Depois da aprovação, produzimos cada peça com a sua marca.",
  },
  {
    titulo: "Entrega",
    texto: "Enviamos tudo pronto para o endereço combinado.",
  },
];

export default function ParaEmpresasPage() {
  return (
    <div className="overflow-hidden">
      {/* Abertura: texto e colagem de duas fotos (a menor encaixada no canto). */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-8 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:pb-28">
        <RevealOnScroll>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Sensora para empresas
          </p>
          <h1 className="mt-4 font-serif text-4xl font-normal leading-tight tracking-tight text-brand-navy sm:text-5xl">
            Presentes sensoriais com a assinatura da sua marca
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-600">
            Velas, sprays, difusores e kits personalizados para colaboradores,
            clientes, eventos e ações de marca — do briefing à entrega.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#proposta"
              className="bg-brand-navy px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-brand-orange"
            >
              Solicitar proposta
            </a>
            <a
              href="#como-funciona"
              className="text-[12px] font-semibold uppercase tracking-[0.2em] text-brand-navy underline-offset-8 hover:underline"
            >
              Como funciona
            </a>
          </div>
          <p className="mt-6 text-[13px] text-slate-500">
            Pedidos a partir de {PEDIDO_MINIMO_EMPRESAS} unidades ·
            personalização completa
          </p>
        </RevealOnScroll>
        <RevealOnScroll delayMs={120}>
          <div className="relative mx-auto w-full max-w-md pb-16">
            <FotoAmostra
              src="/images/hero/velas-4-estacoes.png"
              alt="Velas Sensora personalizadas"
              sizes="(max-width: 1024px) 85vw, 380px"
              className="ml-auto aspect-[4/5] w-[85%] rounded-3xl"
            />
            <FotoAmostra
              src="/images/categories/sprays-de-ambiente.jpg"
              alt="Sprays Sensora personalizados"
              sizes="(max-width: 1024px) 50vw, 220px"
              className="absolute! -left-2 bottom-0 aspect-square w-1/2 rounded-3xl ring-8 ring-background sm:-left-10"
            />
          </div>
        </RevealOnScroll>
      </section>

      {/* Posicionamento */}
      <section className="bg-[#fbe9dd]/60 px-6 py-20 text-center lg:py-24">
        <RevealOnScroll className="mx-auto max-w-3xl">
          <p className="font-serif text-3xl leading-snug text-brand-navy sm:text-4xl">
            Brinde de catálogo se esquece.{" "}
            <span className="italic text-brand-orange">Um aroma, não.</span>
          </p>
          <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-slate-600">
            Começamos pela intenção: o que a sua empresa quer que as pessoas
            sintam ao abrir o presente. A partir daí, escolhemos juntos produto,
            fragrância e acabamento.
          </p>
        </RevealOnScroll>
      </section>

      {/* Produtos personalizáveis */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-28">
        <RevealOnScroll className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            O que personalizamos
          </p>
          <h2 className="mt-3 font-serif text-3xl font-normal text-brand-navy sm:text-4xl">
            Produtos Sensora com a identidade da sua empresa
          </h2>
        </RevealOnScroll>
        <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUTOS.map((produto, i) => (
            <li key={produto.nome}>
              <RevealOnScroll delayMs={i * 90}>
                <FotoAmostra
                  src={produto.imagem}
                  alt={produto.nome}
                  sizes="(max-width: 640px) 100vw, 270px"
                  className="aspect-[4/5]"
                />
                <h3 className="mt-4 font-serif text-xl text-brand-navy">
                  {produto.nome}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {produto.texto}
                </p>
              </RevealOnScroll>
            </li>
          ))}
        </ul>
      </section>

      {/* Por que presentes sensoriais */}
      <section className="bg-brand-navy px-6 py-20 text-white lg:py-28">
        <div className="mx-auto max-w-6xl lg:px-4">
          <RevealOnScroll className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange-light">
              Por que um presente sensorial
            </p>
            <h2 className="mt-3 font-serif text-3xl font-normal sm:text-4xl">
              Estratégia de marca aplicada aos sentidos
            </h2>
          </RevealOnScroll>
          <ul className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {MOTIVOS.map((motivo, i) => (
              <li key={motivo.titulo} className="border-t border-white/20 pt-6">
                <RevealOnScroll delayMs={i * 90}>
                  <span className="font-serif text-3xl text-brand-orange-light">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 font-serif text-xl">{motivo.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    {motivo.texto}
                  </p>
                </RevealOnScroll>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Como funciona */}
      <section
        id="como-funciona"
        className="mx-auto max-w-6xl scroll-mt-28 px-6 py-20 lg:px-10 lg:py-28"
      >
        <RevealOnScroll className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Como funciona
          </p>
          <h2 className="mt-3 font-serif text-3xl font-normal text-brand-navy sm:text-4xl">
            Do briefing à entrega, em 4 passos
          </h2>
        </RevealOnScroll>
        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map((passo, i) => (
            <li key={passo.titulo} className="text-center">
              <RevealOnScroll delayMs={i * 90}>
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brand-orange font-serif text-xl text-brand-orange">
                  {i + 1}
                </span>
                <h3 className="mt-5 font-serif text-xl text-brand-navy">
                  {passo.titulo}
                </h3>
                <p className="mx-auto mt-2 max-w-[24ch] text-sm leading-relaxed text-slate-600">
                  {passo.texto}
                </p>
              </RevealOnScroll>
            </li>
          ))}
        </ol>
      </section>

      {/* Formulário */}
      <section
        id="proposta"
        className="scroll-mt-24 bg-stone-100 px-6 py-20 lg:py-28"
      >
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16 lg:px-4">
          {/* Título, foto e o que acontece depois do envio. */}
          <RevealOnScroll>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
              Solicite uma proposta
            </p>
            <h2 className="mt-3 font-serif text-3xl font-normal text-brand-navy sm:text-4xl">
              Vamos criar algo único para a sua marca?
            </h2>
            <p className="mt-5 leading-relaxed text-slate-600">
              Conte um pouco sobre o projeto. Nossa equipe retorna com sugestões
              de produtos, fragrâncias e personalização.
            </p>
            <div className="relative mt-8 pb-24">
              <FotoAmostra
                src="/images/about/sobre-sensora.jpg"
                alt="Produção Sensora"
                sizes="(max-width: 1024px) 100vw, 420px"
                className="aspect-video rounded-2xl"
              />
              <div className="absolute inset-x-6 bottom-0 rounded-2xl bg-white p-5 shadow-lg">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-orange">
                  Depois do envio
                </p>
                <ol className="mt-3 space-y-2.5">
                  {DEPOIS_DO_ENVIO.map((passo, i) => (
                    <li
                      key={passo}
                      className="flex items-center gap-3 text-sm text-brand-navy"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-[11px] font-semibold text-white">
                        {i + 1}
                      </span>
                      {passo}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </RevealOnScroll>
          <RevealOnScroll delayMs={120}>
            <FormularioProposta />
          </RevealOnScroll>
        </div>
      </section>
    </div>
  );
}
