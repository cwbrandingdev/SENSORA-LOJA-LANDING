import { LOJA_URL } from "@/lib/config";

export type CategorySlug = "velas" | "sprays" | "difusores";

export type NavCategory = {
  label: string;
  href: string;
};

export type HeroSlide = {
  id: string;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  ctaHref: string;
  imageAlt: string;
  /** Quando definido, a imagem final substitui o placeholder automaticamente. */
  imageSrc?: string;
  /** Usar quando a arte do slide já traz título/subtítulo desenhados nela. */
  hideOverlayHeading?: boolean;
};

export type ProductCategory = {
  id: string;
  label: string;
  href: string;
  /** Quando definido, a imagem final substitui o placeholder automaticamente. */
  imageSrc?: string;
};

export type AboutContent = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  imageAlt: string;
  /** Quando definido, a imagem final substitui o placeholder automaticamente. */
  imageSrc?: string;
};

export type FragranceNotes = {
  top?: string[];
  heart?: string[];
  base?: string[];
};

export type ProductItem = {
  slug: string;
  name: string;
  /** Rótulo curto exibido como chip/eyebrow (ex.: "Primavera"). */
  seasonLabel?: string;
  description: string;
  /** Notas olfativas — só renderizado quando definido. */
  notes?: FragranceNotes;
  /** Sensação/atmosfera transmitida pelo produto. */
  mood?: string;
  imageSrc?: string;
  imageAlt: string;
  ctaLabel: string;
  ctaHref: string;
};

export type Collection = {
  slug: string;
  categorySlug: CategorySlug;
  name: string;
  tagline?: string;
  description: string;
  heroImageSrc?: string;
  /** Só é usado quando heroImageSrc está definido. */
  heroImageAlt?: string;
  /** Rótulo curto acima do nome (ex.: "Kit", "Coleção"). Default: "Kit". */
  eyebrow?: string;
  /** Texto do CTA final, sem a seta (ex.: "Conhecer kit"). Default: "Conhecer kit". */
  ctaLabel?: string;
  items: ProductItem[];
};

/** Item visual simples de uma categoria sem coleção temática própria (ex.: Sprays, Difusores). */
export type CategoryProduct = {
  slug: string;
  name: string;
  imageSrc: string;
  imageAlt: string;
};

export type Category = {
  slug: CategorySlug;
  label: string;
  description: string;
  imageSrc?: string;
  /** Produtos apresentados via CategoryProducts quando a categoria não tem uma Collection própria. */
  products?: CategoryProduct[];
};

// ---------------------------------------------------------------------------
// Categorias — fonte única. Navbar, Footer, home e as páginas /[category]
// derivam tudo daqui; adicionar uma categoria nova não exige nenhum arquivo
// de rota novo (ver app/[category]/**).
// ---------------------------------------------------------------------------

export const CATEGORIES: Category[] = [
  {
    slug: "velas",
    label: "Velas Aromáticas",
    description:
      "Velas perfumadas que transformam qualquer ambiente em uma experiência sensorial completa.",
    imageSrc: "/images/categories/velas-aromaticas.jpg",
  },
  {
    slug: "sprays",
    label: "Sprays de Ambiente",
    description:
      "Fragrâncias em spray para perfumar o ambiente na hora, com a assinatura Sensora.",
    imageSrc: "/images/products/sprays/flor-de-laranjeira.jpg",
  },
  {
    slug: "difusores",
    label: "Difusores de Aroma",
    description:
      "Fragrância contínua e discreta para manter a atmosfera perfumada o dia inteiro.",
    imageSrc: "/images/categories/difusores-de-aroma.jpg",
  },
];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}

export function getCategoryHref(slug: CategorySlug): string {
  return `/${slug}`;
}

// ---------------------------------------------------------------------------
// Coleções — cada uma pertence a uma categoria via categorySlug. Uma nova
// coleção (nesta ou em outra categoria) é só um novo item neste array: ela
// aparece sozinha em /colecoes e na página da sua categoria.
// ---------------------------------------------------------------------------

const VELAS_4_ESTACOES: Collection = {
  slug: "4-estacoes",
  categorySlug: "velas",
  name: "Velas 4 Estações",
  tagline: "Primavera, Verão, Outono e Inverno em um kit.",
  description:
    "Quatro atmosferas, infinitas memórias. Um kit criado para transformar cada momento do ano em uma experiência de aconchego, beleza e sensações que permanecem.",
  heroImageSrc: "/images/hero/velas.png",
  heroImageAlt:
    "Kit de velas aromáticas 4 Estações da Sensora, com as quatro velas lado a lado sobre uma bancada",
  items: [
    {
      slug: "primavera",
      name: "Frescor de Primavera",
      seasonLabel: "Primavera",
      description:
        "[Descrição a definir: notas e inspiração da vela Frescor de Primavera.]",
      mood: "Notas frescas que despertam os sentidos e renovam o ambiente.",
      imageSrc: "/images/collections/velas-4-estacoes/primavera.jpg",
      imageAlt: "Vela aromática Frescor de Primavera da Sensora",
      ctaLabel: "Conhecer vela",
      ctaHref: LOJA_URL,
    },
    {
      slug: "verao",
      name: "Luz de Verão",
      seasonLabel: "Verão",
      description:
        "[Descrição a definir: notas e inspiração da vela Luz de Verão.]",
      mood: "Uma brisa cítrica e luminosa para dias longos e leves.",
      imageSrc: "/images/collections/velas-4-estacoes/verao.jpg",
      imageAlt: "Vela aromática Luz de Verão da Sensora",
      ctaLabel: "Conhecer vela",
      ctaHref: LOJA_URL,
    },
    {
      slug: "outono",
      name: "Manhã de Outono",
      seasonLabel: "Outono",
      description:
        "[Descrição a definir: notas e inspiração da vela Manhã de Outono.]",
      mood: "Aromas quentes que convidam ao aconchego das manhãs mais lentas.",
      imageSrc: "/images/collections/velas-4-estacoes/outono.jpg",
      imageAlt: "Vela aromática Manhã de Outono da Sensora",
      ctaLabel: "Conhecer vela",
      ctaHref: LOJA_URL,
    },
    {
      slug: "inverno",
      name: "Brisa de Inverno",
      seasonLabel: "Inverno",
      description:
        "[Descrição a definir: notas e inspiração da vela Brisa de Inverno.]",
      mood: "Calor e conforto em cada respiro dos dias mais frios.",
      imageSrc: "/images/collections/velas-4-estacoes/inverno.jpg",
      imageAlt: "Vela aromática Brisa de Inverno da Sensora",
      ctaLabel: "Conhecer vela",
      ctaHref: LOJA_URL,
    },
  ],
};

const SPRAYS_DE_AMBIENTE: Collection = {
  slug: "sprays-de-ambiente",
  categorySlug: "sprays",
  name: "Sprays de Ambiente",
  tagline: "Baunilha, Especiarias e Flor de Laranjeira em uma coleção.",
  description:
    "Fragrâncias em spray para perfumar o ambiente na hora, com a assinatura Sensora.",
  heroImageSrc: "/images/hero/banner-sprays-novos.png",
  heroImageAlt:
    "Coleção de sprays de ambiente Sensora, com os três frascos lado a lado sobre uma bancada",
  eyebrow: "Coleção",
  ctaLabel: "Conhecer sprays",
  items: [
    {
      slug: "baunilha",
      name: "Baunilha",
      description:
        "[Descrição a definir: notas e inspiração do spray Baunilha.]",
      mood: "Um aroma doce e envolvente que aquece o ambiente na hora.",
      imageSrc: "/images/products/sprays/baunilha.jpg",
      imageAlt: "Spray de ambiente Baunilha da Sensora",
      ctaLabel: "Conhecer spray",
      ctaHref: LOJA_URL,
    },
    {
      slug: "especiarias",
      name: "Especiarias",
      description:
        "[Descrição a definir: notas e inspiração do spray Especiarias.]",
      mood: "Notas quentes e marcantes que trazem aconchego para a casa.",
      imageSrc: "/images/products/sprays/especiarias.jpg",
      imageAlt: "Spray de ambiente Especiarias da Sensora",
      ctaLabel: "Conhecer spray",
      ctaHref: LOJA_URL,
    },
    {
      slug: "flor-de-laranjeira",
      name: "Flor de Laranjeira",
      description:
        "[Descrição a definir: notas e inspiração do spray Flor de Laranjeira.]",
      mood: "Um toque floral e cítrico que renova o ar do ambiente.",
      imageSrc: "/images/products/sprays/flor-de-laranjeira.jpg",
      imageAlt: "Spray de ambiente Flor de Laranjeira da Sensora",
      ctaLabel: "Conhecer spray",
      ctaHref: LOJA_URL,
    },
  ],
};

const DIFUSORES_DE_AROMA: Collection = {
  slug: "difusores-de-aroma",
  categorySlug: "difusores",
  name: "Difusores de Aroma",
  tagline: "Baunilha, Especiarias e Flor de Laranjeira em uma coleção.",
  description:
    "Fragrância contínua e discreta para manter a atmosfera perfumada o dia inteiro.",
  heroImageSrc: "/images/hero/difusores-de-aroma-banner.jpg",
  heroImageAlt:
    "Coleção de difusores de aroma Sensora, com os três difusores lado a lado sobre uma bancada",
  eyebrow: "Coleção",
  ctaLabel: "Conhecer difusores",
  items: [
    {
      slug: "baunilha",
      name: "Baunilha",
      description:
        "[Descrição a definir: notas e inspiração do difusor Baunilha.]",
      mood: "Perfume doce e envolvente, presente no ambiente o dia inteiro.",
      imageSrc: "/images/products/difusores/baunilha.jpg",
      imageAlt: "Difusor de aroma Baunilha da Sensora",
      ctaLabel: "Conhecer difusor",
      ctaHref: LOJA_URL,
    },
    {
      slug: "especiarias",
      name: "Especiarias",
      description:
        "[Descrição a definir: notas e inspiração do difusor Especiarias.]",
      mood: "Notas quentes e marcantes, difundidas de forma contínua e discreta.",
      imageSrc: "/images/products/difusores/especiarias.jpg",
      imageAlt: "Difusor de aroma Especiarias da Sensora",
      ctaLabel: "Conhecer difusor",
      ctaHref: LOJA_URL,
    },
    {
      slug: "flor-de-laranjeira",
      name: "Flor de Laranjeira",
      description:
        "[Descrição a definir: notas e inspiração do difusor Flor de Laranjeira.]",
      mood: "Um toque floral e cítrico que perfuma o ambiente sem pressa.",
      imageSrc: "/images/products/difusores/flor-de-laranjeira.jpg",
      imageAlt: "Difusor de aroma Flor de Laranjeira da Sensora",
      ctaLabel: "Conhecer difusor",
      ctaHref: LOJA_URL,
    },
  ],
};

export const COLLECTIONS: Collection[] = [
  VELAS_4_ESTACOES,
  SPRAYS_DE_AMBIENTE,
  DIFUSORES_DE_AROMA,
];

export function getCollectionsByCategory(categorySlug: string): Collection[] {
  return COLLECTIONS.filter(
    (collection) => collection.categorySlug === categorySlug,
  );
}

export function getCollection(
  categorySlug: string,
  collectionSlug: string,
): Collection | undefined {
  return COLLECTIONS.find(
    (collection) =>
      collection.categorySlug === categorySlug &&
      collection.slug === collectionSlug,
  );
}

export function getItem(
  categorySlug: string,
  collectionSlug: string,
  itemSlug: string,
): { collection: Collection; item: ProductItem } | undefined {
  const collection = getCollection(categorySlug, collectionSlug);
  const item = collection?.items.find(
    (candidate) => candidate.slug === itemSlug,
  );
  return collection && item ? { collection, item } : undefined;
}

export function getCollectionHref(
  collection: Pick<Collection, "categorySlug" | "slug">,
): string {
  return `/${collection.categorySlug}/${collection.slug}`;
}

export function getItemHref(
  collection: Pick<Collection, "categorySlug" | "slug">,
  item: Pick<ProductItem, "slug">,
): string {
  return `${getCollectionHref(collection)}/${item.slug}`;
}

// ---------------------------------------------------------------------------
// Navegação — derivada de CATEGORIES, sem lista escrita à mão. "Coleções"
// não é uma categoria de produto, é um índice transversal (/colecoes).
// ---------------------------------------------------------------------------

export const NAV_CATEGORIES: NavCategory[] = [
  ...CATEGORIES.map((category) => ({
    label: category.label,
    href: getCategoryHref(category.slug),
  })),
  { label: "Kits", href: "/colecoes" },
  { label: "Loja", href: "/loja" },
];

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  ...CATEGORIES.map((category) => ({
    id: category.slug,
    label: category.label,
    href: getCategoryHref(category.slug),
    imageSrc: category.imageSrc,
  })),
  {
    id: "colecoes",
    label: "Kits",
    href: "/colecoes",
    imageSrc: "/images/categories/kits.png",
  },
];

// ---------------------------------------------------------------------------
// Slides do carrossel principal. Adicionar um novo banner é só incluir um
// novo item aqui — o componente HeroCarousel já suporta N slides.
// ---------------------------------------------------------------------------

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "velas-4-estacoes",
    title: "Kit 4 Estações",
    subtitle: VELAS_4_ESTACOES.description,
    ctaLabel: "Conhecer kit",
    ctaHref: getCollectionHref(VELAS_4_ESTACOES),
    imageAlt: VELAS_4_ESTACOES.heroImageAlt ?? "",
    imageSrc: "/images/hero/colecao-4-estacoes-banner.png",
  },
  {
    id: "sprays-de-ambiente",
    title: "Sprays de Ambiente",
    subtitle: "Perfume o seu espaço com a assinatura Sensora.",
    ctaLabel: "Conhecer kit",
    ctaHref: getCategoryHref("sprays"),
    imageAlt: "Sprays de ambiente Sensora",
    imageSrc: "/images/hero/banner-sprays-novos.png",
  },
  {
    id: "difusores-de-aroma",
    title: "Difusores de Aroma",
    subtitle: "Fragrância contínua para todos os ambientes.",
    ctaLabel: "Conhecer kit",
    ctaHref: getCategoryHref("difusores"),
    imageAlt: "Difusores de aroma Sensora",
    imageSrc: "/images/hero/difusores-de-aroma-banner.jpg",
  },
];

export const ABOUT_CONTENT: AboutContent = {
  eyebrow: "Marketing Sensorial",
  title: "Sobre a Sensora",
  paragraphs: [
    "Na Sensora Home, acreditamos que os aromas têm o poder de transformar a forma como vivemos nossos espaços. Uma fragrância pode despertar uma lembrança, marcar um momento ou simplesmente mudar a atmosfera de um ambiente. É por isso que criamos aromas que convidam você a sentir a casa de uma maneira diferente.",
    "Cada produto nasce da nossa experiência com o marketing sensorial, unindo perfumaria, estética e cuidado para transformar o cotidiano em experiências que despertam os sentidos. Porque uma casa bem perfumada não é apenas percebida — ela é sentida.",
  ],
  imageAlt: "Spray de ambiente Sensora Baunilha em um quarto aconchegante",
  imageSrc: "/images/about/sobre-sensora.png",
};

export const MANIFESTO_CONTENT = {
  quote: "Onde marcas são sentidas.",
};

export const FOOTER_CONTENT = {
  tagline: "Marcas sentidas, em cada detalhe.",
  contact: {
    email: "sensoramarketingsensorial@gmail.com",
    phone: "[telefone de contato a definir]",
  },
  social: [
    {
      label: "Instagram",
      href: "https://www.instagram.com/sensoramarketingsensorial/",
    },
    { label: "Facebook", href: "#" },
  ],
};
