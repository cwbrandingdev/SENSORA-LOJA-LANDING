import type { Metadata } from "next";
import Link from "next/link";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import { ABOUT_CONTENT } from "@/lib/content";
import { EMPRESA, ENDERECO_LINHA, ROTAS_LEGAIS } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Quem somos",
  description:
    "A Sensora é a marca de marketing sensorial da Cazarim & Souza Ltda. Razão social, CNPJ e endereço da loja.",
};

const CITACAO = "Uma casa bem perfumada não é apenas percebida — ela é sentida.";

const DOCUMENTOS = [
  { label: "Termos de Uso", href: ROTAS_LEGAIS.termos },
  { label: "Política de Privacidade", href: ROTAS_LEGAIS.privacidade },
  { label: "Trocas, devoluções e arrependimento", href: ROTAS_LEGAIS.trocas },
  { label: "Política de Cookies", href: ROTAS_LEGAIS.cookies },
];

const FICHA = [
  { termo: "Razão social", valor: EMPRESA.razaoSocial },
  { termo: "CNPJ", valor: EMPRESA.cnpj },
  { termo: "Endereço", valor: ENDERECO_LINHA },
  {
    termo: "E-mail",
    valor: (
      <a href={`mailto:${EMPRESA.email}`} className="hover:text-brand-orange">
        {EMPRESA.email}
      </a>
    ),
  },
  {
    termo: "Instagram",
    valor: (
      <a
        href={EMPRESA.instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4 hover:text-brand-orange"
      >
        {EMPRESA.instagram}
      </a>
    ),
  },
];

export default function QuemSomosPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Manchas de cor desfocadas ao fundo. */}
      <div aria-hidden className="absolute top-40 -right-20 h-96 w-96 rounded-full bg-brand-orange/15 blur-3xl" />
      <div aria-hidden className="absolute top-[60%] left-1/4 h-80 w-80 rounded-full bg-[#dbe4f0]/60 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 pt-6 pb-24 lg:px-10 lg:pb-32">
        <p
          aria-hidden
          className="select-none text-center font-serif text-[22vw] leading-none text-brand-navy/5 lg:text-[13rem]"
        >
          Sensora
        </p>

        <div className="-mt-10 flex flex-col gap-12 lg:-mt-20 lg:flex-row lg:items-center lg:gap-20">
          <div className="relative mx-auto aspect-square w-full max-w-sm shrink-0 overflow-hidden rounded-[60%_40%_30%_70%/60%_30%_70%_40%] lg:mx-0 lg:w-5/12">
            <PlaceholderImage
              src={ABOUT_CONTENT.imageSrc}
              alt={ABOUT_CONTENT.imageAlt}
              label={ABOUT_CONTENT.title}
              priority
              sizes="(max-width: 1024px) 100vw, 450px"
            />
          </div>

          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
              {ABOUT_CONTENT.eyebrow}
            </p>
            <h1 className="mt-3 font-serif text-5xl text-brand-navy sm:text-6xl">Quem somos</h1>
            <p className="mt-6 leading-relaxed text-slate-600 first-letter:float-left first-letter:mr-3 first-letter:font-serif first-letter:text-6xl first-letter:leading-none first-letter:text-brand-orange">
              {ABOUT_CONTENT.paragraphs[0]}
            </p>
          </div>
        </div>

        <blockquote className="mx-auto mt-20 max-w-3xl rounded-[2.5rem] bg-[#fbe9dd] px-8 py-10 text-center font-serif text-2xl italic leading-snug text-brand-navy sm:text-3xl">
          “{CITACAO}”
        </blockquote>

        <div className="mx-auto mt-10 max-w-2xl space-y-4 text-center leading-relaxed text-slate-600">
          <p>{ABOUT_CONTENT.paragraphs[1]}</p>
          <p className="text-sm text-slate-500">
            A marca Sensora é operada por {EMPRESA.razaoSocial}. Os produtos perfumam o ambiente. Não
            prometem efeito terapêutico, medicinal ou de desinfecção.
          </p>
        </div>

        <div className="mt-20 grid gap-5 md:grid-cols-2">
          <div className="min-w-0 rounded-[2.5rem] bg-[#e8eef6] p-6 sm:p-8">
            <h2 className="font-serif text-2xl text-brand-navy">Ficha técnica</h2>
            <dl className="mt-4 divide-y divide-white text-sm">
              {FICHA.map((item) => (
                <div key={item.termo} className="grid grid-cols-[6rem_1fr] gap-3 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4">
                  <dt className="text-xs uppercase tracking-[0.15em] text-slate-500">{item.termo}</dt>
                  <dd className="min-w-0 wrap-anywhere text-brand-navy">{item.valor}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="min-w-0 rounded-[2.5rem] bg-[#f5f2ed] p-6 sm:p-8">
            <h2 className="font-serif text-2xl text-brand-navy">Documentos da loja</h2>
            <ol className="mt-4 space-y-2">
              {DOCUMENTOS.map((doc, i) => (
                <li key={doc.href}>
                  <Link
                    href={doc.href}
                    className="flex items-baseline gap-4 rounded-full bg-white px-5 py-3 text-brand-navy transition-colors hover:bg-brand-orange hover:text-white"
                  >
                    <span className="font-serif text-brand-orange">{String(i + 1).padStart(2, "0")}</span>
                    {doc.label}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
