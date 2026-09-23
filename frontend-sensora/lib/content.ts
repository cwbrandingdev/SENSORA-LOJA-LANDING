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
  /** Slug do produto real na Loja (`/public/produtos`) — mapeamento
   *  conferido manualmente contra o catálogo real, nunca inventado. Quando
   *  presente, o card deste item vira um link para `/loja/produtos/{slug}`
   *  (ver CollectionShowcase.tsx); ausente = item continua sem link, como
   *  hoje. */
  lojaSlug?: string;
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

/** Card único representando um kit físico como UM produto (não uma lista de
 *  itens avulsos) — diferente de `Collection`, que sempre renderiza uma
 *  grade de `items`. Usado pelo Kit 4 Estações em `/velas` (ver
 *  KitShowcaseCard.tsx): uma imagem só, mostrando as 4 velas juntas. */
export type KitShowcase = {
  name: string;
  eyebrow?: string;
  tagline?: string;
  /** Rótulo curto de especificação (ex.: "4 × 220ml"). Só renderizado quando definido. */
  specs?: string;
  /** Estações/aromas mostrados discretamente abaixo do texto principal. */
  seasons?: string[];
  imageSrc: string;
  imageAlt: string;
  /** Slug do produto real do kit na Loja — ainda não existe (nenhum SKU de
   *  kit cadastrado no backend). Quando definido, o card vira link para
   *  `/loja/produtos/{slug}`; ausente = card visual, sem link, sem apontar
   *  para nenhuma das 4 velas avulsas. Nunca inventar este valor. */
  lojaSlug?: string;
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
// saparece sozinha em /colecoes e na página da sua categoria.
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
        "Composição: Vela vegana, feita com cera de coco 100% vegetal, livre de parafina.\n\nDetalhes: Rótulo com acabamento metalizado e tampa de metal, desenvolvidos especialmente para a coleção 4 Estações.\n\nEssência: Frescor de Primavera\nFamília Olfativa: Floral Fresco\n\nNotas de Cabeça:\nPera, Folha de Figo e Bergamota\nNotas de Corpo:\nPeônia, Flor de Laranjeira e Chá Branco\nNotas de Fundo:\nAlmíscar, Cedro e Musgo\n\nVolume: 220ml\nTempo de queima: Aproximadamente 40 a 50 horas",
      mood: "Notas frescas que despertam os sentidos e renovam o ambiente.",
      imageSrc: "/images/collections/velas-4-estacoes/primavera.jpg",
      imageAlt: "Vela aromática Frescor de Primavera da Sensora",
      ctaLabel: "Conhecer vela",
      ctaHref: LOJA_URL,
      lojaSlug: "vela-frescor-da-primavera",
    },
    {
      slug: "verao",
      name: "Luz de Verão",
      seasonLabel: "Verão",
      description:
        "Composição: Vela vegana, feita com cera de coco 100% vegetal, livre de parafina.\n\nDetalhes: Rótulo com acabamento metalizado e tampa de metal, desenvolvidos especialmente para a coleção 4 Estações.\n\nEssência: Luz de Verão\nFamília Olfativa: Cítrico Floral\n\nNotas de Cabeça:\nBergamota, Limão Siciliano e Mandarina\nNotas de Corpo:\nFlor de Laranjeira, Jasmim e Pêssego\nNotas de Fundo:\nAlmíscar, Âmbar e Madeira Clara\n\nVolume: 220ml\nTempo de queima: Aproximadamente 40 a 50 horas",
      mood: "Uma brisa cítrica e luminosa para dias longos e leves.",
      imageSrc: "/images/collections/velas-4-estacoes/verao.jpg",
      imageAlt: "Vela aromática Luz de Verão da Sensora",
      ctaLabel: "Conhecer vela",
      ctaHref: LOJA_URL,
      lojaSlug: "vela-luz-de-verao",
    },
    {
      slug: "outono",
      name: "Manhã de Outono",
      seasonLabel: "Outono",
      description:
        "Composição: Vela vegana, feita com cera de coco 100% vegetal, livre de parafina.\n\nDetalhes: Rótulo com acabamento metalizado e tampa de metal, desenvolvidos especialmente para a coleção 4 Estações.\n\nEssência: Manhã de Outono\nFamília Olfativa: Oriental Especiado\n\nNotas de Cabeça:\nLaranja, Canela e Maçã\nNotas de Corpo:\nCravo, Noz-moscada e Flor de Baunilha\nNotas de Fundo:\nÂmbar, Sândalo e Baunilha\n\nVolume: 220ml\nTempo de queima: Aproximadamente 40 a 50 horas",
      mood: "Aromas quentes que convidam ao aconchego das manhãs mais lentas.",
      imageSrc: "/images/collections/velas-4-estacoes/outono.jpg",
      imageAlt: "Vela aromática Manhã de Outono da Sensora",
      ctaLabel: "Conhecer vela",
      ctaHref: LOJA_URL,
      lojaSlug: "vela-manha-de-outono",
    },
    {
      slug: "inverno",
      name: "Brisa de Inverno",
      seasonLabel: "Inverno",
      description:
        "Composição: Vela vegana, feita com cera de coco 100% vegetal, livre de parafina.\n\nDetalhes: Rótulo com acabamento metalizado e tampa de metal, desenvolvidos especialmente para a coleção 4 Estações.\n\nEssência: Brisa de Inverno\nFamília Olfativa: Amadeirado Oriental\n\nNotas de Cabeça:\nBergamota, Pimenta Rosa e Eucalipto\nNotas de Corpo:\nLavanda, Cedro e Canela\nNotas de Fundo:\nÂmbar, Almíscar e Baunilha\n\nVolume: 220ml\nTempo de queima: Aproximadamente 40 a 50 horas",
      mood: "Calor e conforto em cada respiro dos dias mais frios.",
      imageSrc: "/images/collections/velas-4-estacoes/inverno.jpg",
      imageAlt: "Vela aromática Brisa de Inverno da Sensora",
      ctaLabel: "Conhecer vela",
      ctaHref: LOJA_URL,
      lojaSlug: "vela-brisa-de-inverno",
    },
  ],
};

// Card único do Kit 4 Estações — não é uma Collection (não tem items[], não
// vira rota própria, não aparece em /colecoes nem em generateStaticParams).
// Vive só em /velas, logo abaixo da apresentação das 4 velas avulsas (ver
// [category]/page.tsx), como UMA apresentação do kit físico — nunca como
// 4 cards repetidos.
//
// `lojaSlug`/`imageSrc` conferidos direto em `/public/produtos` de produção
// (produto real "Kit velas", id 46, categoria Kits) — nunca inventados. A
// imagem é a mesma já cadastrada no Admin para esse produto (ImageKit,
// retrato/closeup das 4 velas) — o card mostra em `KitShowcaseCard.tsx` num
// layout de imagem+texto lado a lado (não mais texto sobreposto na
// imagem), então o recorte apertado deixou de ser um problema.
export const KIT_4_ESTACOES_SHOWCASE: KitShowcase = {
  name: "As Quatro Estações",
  eyebrow: "Kit de Velas Aromáticas",
  tagline: "Quatro fragrâncias para acompanhar todos os momentos do ano.",
  specs: "4 × 220ml",
  seasons: ["Primavera", "Verão", "Outono", "Inverno"],
  imageSrc:
    "https://ik.imagekit.io/phof1v4q8/sensora/products/kit-velas-1789408972184_kPMp7Nbik.png",
  imageAlt: "Kit Velas Sensora — as quatro velas aromáticas reunidas",
  lojaSlug: "kit-velas",
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
  eyebrow: "Kit",
  ctaLabel: "Conhecer sprays",
  items: [
    {
      slug: "baunilha",
      name: "Baunilha",
      description:
        "Baunilha é uma fragrância doce, cremosa e envolvente. A flor de baunilha se encontra com pera e leite, e o toque de mel e caramelo deixa o ambiente quente, aconchegante e acolhedor.\n\nDetalhes: Frasco com rótulo de acabamento metalizado e válvula spray dourada. O home spray acompanha uma caixa personalizada Parafinesse, desenvolvida especialmente para a coleção e também com detalhes metalizados.\n\nEssência: Baunilha\nFamília Olfativa: Gourmand\n\nNotas de Cabeça:\nBaunilha, Pera e Leite\nNotas de Corpo:\nFlor de Baunilha, Mel e Tonka\nNotas de Fundo:\nCaramelo, Almíscar e Âmbar\n\nVolume: 250ml\nRendimento: Aproximadamente 2.000 borrifadas",
      mood: "Um aroma doce e envolvente que aquece o ambiente na hora.",
      imageSrc: "/images/products/sprays/baunilha.jpg",
      imageAlt: "Spray de ambiente Baunilha da Sensora",
      ctaLabel: "Conhecer spray",
      ctaHref: LOJA_URL,
      lojaSlug: "spray-arroma-de-baunilha",
    },
    {
      slug: "especiarias",
      name: "Especiarias",
      description:
        "Especiarias é uma fragrância quente, especiada e marcante. Canela, cravo e noz-moscada ganham um fundo ambarado, criando uma atmosfera intensa e aconchegante para perfumar os ambientes.\n\nDetalhes: Frasco com rótulo de acabamento metalizado e válvula spray dourada. O home spray acompanha uma caixa personalizada Parafinesse, desenvolvida especialmente para a coleção e também com detalhes metalizados.\n\nEssência: Especiarias\nFamília Olfativa: Oriental Especiado\n\nNotas de Cabeça:\nLaranja, Canela e Pimenta Rosa\nNotas de Corpo:\nCravo, Noz-moscada e Cardamomo\nNotas de Fundo:\nÂmbar, Sândalo e Baunilha\n\nVolume: 250ml\nRendimento: Aproximadamente 2.000 borrifadas",
      mood: "Notas quentes e marcantes que trazem aconchego para a casa.",
      imageSrc: "/images/products/sprays/especiarias.jpg",
      imageAlt: "Spray de ambiente Especiarias da Sensora",
      ctaLabel: "Conhecer spray",
      ctaHref: LOJA_URL,
      lojaSlug: "spray-especiarias",
    },
    {
      slug: "flor-de-laranjeira",
      name: "Flor de Laranjeira",
      description:
        "Flor de Laranjeira é uma fragrância floral, cítrica e luminosa. Neroli e flor de laranjeira se encontram com jasmim e pêssego, deixando o ambiente fresco, delicado e arejado.\n\nDetalhes: Frasco com rótulo de acabamento metalizado e válvula spray dourada. O home spray acompanha uma caixa personalizada Parafinesse, desenvolvida especialmente para a coleção e também com detalhes metalizados.\n\nEssência: Flor de Laranjeira\nFamília Olfativa: Floral Cítrico\n\nNotas de Cabeça:\nNeroli, Bergamota e Petitgrain\nNotas de Corpo:\nFlor de Laranjeira, Jasmim e Pêssego\nNotas de Fundo:\nAlmíscar, Cedro e Âmbar\n\nVolume: 250ml\nRendimento: Aproximadamente 2.000 borrifadas",
      mood: "Um toque floral e cítrico que renova o ar do ambiente.",
      imageSrc: "/images/products/sprays/flor-de-laranjeira.jpg",
      imageAlt: "Spray de ambiente Flor de Laranjeira da Sensora",
      ctaLabel: "Conhecer spray",
      ctaHref: LOJA_URL,
      lojaSlug: "spray-flor-de-laranjeira",
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
  eyebrow: "Kit",
  ctaLabel: "Conhecer difusores",
  items: [
    {
      slug: "baunilha",
      name: "Baunilha",
      description:
        "Baunilha é uma fragrância doce, cremosa e acolhedora. A flor de baunilha se encontra com pera e leite, enquanto mel e caramelo envolvem o aroma. Ao fundo, almíscar e âmbar perfumam o ambiente de forma contínua, criando uma atmosfera quente e aconchegante.\n\nDetalhes: Frasco com rótulo de acabamento metalizado, válvula dourada e palitos de fibra de algodão de alta performance, desenvolvidos para proporcionar excelente absorção e difusão da fragrância.\n\nEssência: Baunilha\nFamília Olfativa: Gourmand\n\nNotas de Cabeça:\nBaunilha, Pera e Leite\nNotas de Corpo:\nFlor de Baunilha, Mel e Tonka\nNotas de Fundo:\nCaramelo, Almíscar e Âmbar\n\nVolume: 250ml",
      mood: "Perfume doce e envolvente, presente no ambiente o dia inteiro.",
      imageSrc: "/images/products/difusores/baunilha.jpg",
      imageAlt: "Difusor de aroma Baunilha da Sensora",
      ctaLabel: "Conhecer difusor",
      ctaHref: LOJA_URL,
      lojaSlug: "difusor-de-baunilha",
    },
    {
      slug: "especiarias",
      name: "Especiarias",
      description:
        "Especiarias é uma fragrância quente, especiada e marcante. Canela, cravo e noz-moscada trazem intensidade, enquanto laranja e pimenta rosa abrem o aroma. Ao fundo, âmbar, sândalo e baunilha envolvem a fragrância, perfumando o ambiente de forma contínua e criando uma atmosfera intensa e acolhedora.\n\nDetalhes: Frasco com rótulo de acabamento metalizado, válvula dourada e palitos de fibra de algodão de alta performance, desenvolvidos para proporcionar excelente absorção e difusão da fragrância.\n\nEssência: Especiarias\nFamília Olfativa: Oriental Especiado\n\nNotas de Cabeça:\nLaranja, Canela e Pimenta Rosa\nNotas de Corpo:\nCravo, Noz-moscada e Cardamomo\nNotas de Fundo:\nÂmbar, Sândalo e Baunilha\n\nVolume: 250ml",
      mood: "Notas quentes e marcantes, difundidas de forma contínua e discreta.",
      imageSrc: "/images/products/difusores/especiarias.jpg",
      imageAlt: "Difusor de aroma Especiarias da Sensora",
      ctaLabel: "Conhecer difusor",
      ctaHref: LOJA_URL,
      lojaSlug: "difusor-de-especiarias",
    },
    {
      slug: "flor-de-laranjeira",
      name: "Flor de Laranjeira",
      description:
        "Flor de Laranjeira é uma fragrância floral, cítrica e luminosa. Neroli e flor de laranjeira se encontram com jasmim e pêssego, enquanto almíscar, cedro e âmbar sustentam o aroma. A difusão contínua deixa o ambiente fresco, delicado e arejado.\n\nDetalhes: Frasco com rótulo de acabamento metalizado, válvula dourada e palitos de fibra de algodão de alta performance, desenvolvidos para proporcionar excelente absorção e difusão da fragrância.\n\nEssência: Flor de Laranjeira\nFamília Olfativa: Floral Cítrico\n\nNotas de Cabeça:\nNeroli, Bergamota e Petitgrain\nNotas de Corpo:\nFlor de Laranjeira, Jasmim e Pêssego\nNotas de Fundo:\nAlmíscar, Cedro e Âmbar\n\nVolume: 250ml",
      mood: "Um toque floral e cítrico que perfuma o ambiente sem pressa.",
      imageSrc: "/images/products/difusores/flor-de-laranjeira.jpg",
      imageAlt: "Difusor de aroma Flor de Laranjeira da Sensora",
      ctaLabel: "Conhecer difusor",
      ctaHref: LOJA_URL,
      lojaSlug: "difusor-de-flor-de-laranjeira",
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

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

// FAQ da Landing — respostas de catálogo e checkout vêm do próprio site.
// Arrependimento, garantia e nota fiscal seguem o mínimo legal publicado
// em /trocas-e-devolucoes e /termos-de-uso (não há troca comercial extra).
export const FAQ_CONTENT = {
  eyebrow: "Dúvidas frequentes",
  title: "Perguntas que podem ajudar.",
  intro:
    "Reunimos aqui as respostas mais úteis para quem está conhecendo a Sensora ou já navegando pela loja.",
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "produtos",
    question: "Quais tipos de produtos a Sensora oferece?",
    answer:
      "Trabalhamos com velas aromáticas, sprays de ambiente e difusores de aroma — produtos de marketing sensorial pensados para perfumar e transformar a atmosfera de qualquer espaço.",
  },
  {
    id: "colecoes",
    question: "Quais coleções estão disponíveis?",
    answer:
      "Hoje temos três coleções: as Velas 4 Estações, os Sprays de Ambiente e os Difusores de Aroma. Você encontra todas elas na página de Coleções.",
  },
  {
    id: "4-estacoes",
    question: "O que é a coleção 4 Estações?",
    answer:
      "É o nosso kit de velas aromáticas inspirado nas quatro estações do ano — um kit criado para transformar cada momento em uma experiência de aconchego, beleza e sensações que permanecem.",
  },
  {
    id: "velas-4-estacoes",
    question: "Quais velas fazem parte da coleção 4 Estações?",
    answer:
      "O kit reúne quatro velas: Frescor de Primavera, Luz de Verão, Manhã de Outono e Brisa de Inverno.",
  },
  {
    id: "peso-velas",
    question: "Qual é o volume das velas da coleção 4 Estações?",
    answer:
      "Cada vela da coleção 4 Estações vem com 220ml e queima por aproximadamente 40 a 50 horas. O kit completo reúne 4 × 220ml.",
  },
  {
    id: "aromas",
    question: "Quais aromas estão disponíveis nos sprays e difusores?",
    answer:
      "Os sprays de ambiente e os difusores de aroma estão disponíveis nos aromas Baunilha, Especiarias e Flor de Laranjeira.",
  },
  {
    id: "como-comprar",
    question: "Como funciona a compra pelo site?",
    answer:
      "Basta escolher os produtos e adicioná-los à sacola. Para finalizar, é preciso estar logado (ou criar uma conta), informar o endereço de entrega e escolher a opção de frete — depois disso, você é direcionado a um ambiente seguro para concluir o pagamento.",
  },
  {
    id: "pagamento",
    question: "Como funciona o pagamento?",
    answer:
      "Depois de revisar o pedido e escolher o frete, você é redirecionado a um ambiente de pagamento seguro para concluir a compra.",
  },
  {
    id: "frete",
    question: "Como funciona o cálculo do frete?",
    answer:
      "O frete é calculado automaticamente no checkout, a partir do endereço de entrega escolhido. Você vê diferentes opções de transportadora, com prazo em dias úteis e valor, e escolhe a que preferir.",
  },
  {
    id: "acompanhar-pedido",
    question: "Como acompanho o status do meu pedido?",
    answer:
      "Em Minha Conta → Meus Pedidos você acompanha o histórico e o status de todos os seus pedidos.",
  },
  {
    id: "contato",
    question: "Como entro em contato com a Sensora?",
    answer:
      "Por e-mail, em sensoramarketingsensorial@gmail.com, ou pelo Instagram @sensoramarketingsensorial. Razão social, CNPJ e endereço estão na página Quem somos.",
  },
  {
    id: "arrependimento",
    question: "Posso desistir da compra?",
    answer:
      "Sim. Em compra feita pelo site, você tem 7 dias contados do recebimento para desistir, sem precisar justificar. O pedido é feito por e-mail (sensoramarketingsensorial@gmail.com), com o número do pedido. O valor pago, inclusive o frete da ida, é devolvido, e o frete da volta fica por conta da loja. O passo a passo está em Trocas e devoluções.",
  },
  {
    id: "defeito",
    question: "E se o produto chegar com defeito?",
    answer:
      "Vela, spray e difusor têm garantia legal de 30 dias após o recebimento. Escreva para sensoramarketingsensorial@gmail.com descrevendo o problema. Se não for resolvido em 30 dias, você escolhe troca, abatimento do preço ou dinheiro de volta. Não há troca só porque o aroma ou a cor não agradou, fora do prazo de arrependimento.",
  },
  {
    id: "nota-fiscal",
    question: "Vocês emitem nota fiscal?",
    answer:
      "Sim. A Cazarim & Souza Ltda emite nota fiscal eletrônica da venda, no CPF cadastrado em Dados pessoais. O documento segue por e-mail ou pode ser pedido em sensoramarketingsensorial@gmail.com. Se o CPF estiver em branco, pedimos antes de emitir.",
  },
];

export const FOOTER_CONTENT = {
  tagline: "Marcas sentidas, em cada detalhe.",
  contact: {
    email: "sensoramarketingsensorial@gmail.com",
    phone: "",
  },
  social: [
    {
      label: "Instagram",
      href: "https://www.instagram.com/sensoramarketingsensorial/",
    },
  ],
};
