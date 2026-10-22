import { normalizarBusca, pontuarTexto } from "@/lib/busca-produtos";
import { ROTAS_LEGAIS } from "@/lib/empresa";
import { ROUTES } from "@/lib/routes";

// Páginas do site que a barra de busca encontra além dos produtos. As
// palavras-chave são comparadas sem acento e sem maiúsculas. Páginas da
// conta levam ao login quando o visitante não está logado (e voltam depois).
export type PaginaBusca = { titulo: string; href: string; palavras: string };

export const PAGINAS_BUSCA: PaginaBusca[] = [
  {
    titulo: "Suporte",
    href: ROUTES.CONTA_SUPORTE,
    palavras: "suporte ajuda atendimento contato problema reclamação falar",
  },
  {
    titulo: "Meus pedidos",
    href: ROUTES.CONTA_PEDIDOS,
    palavras: "pedidos compras rastrear rastreio entrega status acompanhar",
  },
  {
    titulo: "Minha conta",
    href: ROUTES.CONTA,
    palavras: "conta perfil cadastro login entrar",
  },
  {
    titulo: "Endereços",
    href: ROUTES.CONTA_ENDERECOS,
    palavras: "endereços cep",
  },
  {
    titulo: "Dados pessoais",
    href: ROUTES.CONTA_DADOS_PESSOAIS,
    palavras: "dados pessoais cpf nome telefone",
  },
  {
    titulo: "Segurança",
    href: ROUTES.CONTA_SEGURANCA,
    palavras: "segurança senha e-mail email",
  },
  {
    titulo: "Trocas e devoluções",
    href: ROTAS_LEGAIS.trocas,
    palavras:
      "trocas devolução devolver arrependimento reembolso estorno defeito garantia",
  },
  {
    titulo: "Perguntas frequentes",
    href: "/faq",
    palavras:
      "faq dúvidas perguntas frete pagamento pix cartão boleto nota fiscal prazo curitiba região metropolitana entrega",
  },
  {
    titulo: "Quem somos",
    href: ROTAS_LEGAIS.quemSomos,
    palavras: "sobre empresa quem somos cnpj endereço loja",
  },
  {
    titulo: "Para empresas",
    href: ROUTES.PARA_EMPRESAS,
    palavras: "empresas corporativo brinde presente personalizado proposta colaboradores clientes evento marca atacado",
  },
  {
    titulo: "Carrinho",
    href: ROUTES.LOJA_CARRINHO,
    palavras: "carrinho sacola",
  },
  {
    titulo: "Kits",
    href: "/colecoes",
    palavras: "kits presentes coleções 4 estações",
  },
  { titulo: "Velas aromáticas", href: "/velas", palavras: "velas aromáticas" },
  {
    titulo: "Sprays de ambiente",
    href: "/sprays",
    palavras: "sprays ambiente aromatizador",
  },
  {
    titulo: "Difusores",
    href: "/difusores",
    palavras: "difusores aroma varetas aromatizador",
  },
  {
    titulo: "Termos de uso",
    href: ROTAS_LEGAIS.termos,
    palavras: "termos uso condições",
  },
  {
    titulo: "Política de privacidade",
    href: ROTAS_LEGAIS.privacidade,
    palavras: "privacidade lgpd dados pessoais",
  },
  {
    titulo: "Política de cookies",
    href: ROTAS_LEGAIS.cookies,
    palavras: "cookies",
  },
];

function textoDaPagina(pagina: PaginaBusca) {
  return `${pagina.titulo} ${pagina.palavras}`;
}

// Mesma regra de produtoCombina: todas as partes do termo aparecem no texto.
export function filtrarPaginas(termo: string, limite = 3) {
  const partes = normalizarBusca(termo).split(/\s+/).filter(Boolean);
  if (!partes.length) return [];
  return PAGINAS_BUSCA.filter((pagina) => {
    const texto = normalizarBusca(textoDaPagina(pagina));
    return partes.every((parte) => texto.includes(parte));
  }).slice(0, limite);
}

// Mesmo corte de sugerirProdutos (0.62) para o "Você quis dizer…?".
export function sugerirPaginas(termo: string, limite = 2) {
  return PAGINAS_BUSCA.map((pagina) => ({
    pagina,
    nota: pontuarTexto(termo, textoDaPagina(pagina)),
  }))
    .filter((item) => item.nota >= 0.62)
    .sort((a, b) => b.nota - a.nota)
    .slice(0, limite)
    .map((item) => item.pagina);
}
