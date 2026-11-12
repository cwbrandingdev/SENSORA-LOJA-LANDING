// Endereços antigos de produtos → endereço atual (troca de 12/11/2026, SEO:
// os antigos eram só o aroma, com números e erros, ex.: "bambu-4").
// A página do produto redireciona (308, permanente) quem chegar por um
// endereço antigo, para não perder o que o Google e quem compartilhou o link
// já tinham. Só é consultado quando o endereço não existe mais no banco.
export const SLUGS_ANTIGOS: Record<string, string> = {
  "kit-velas": "kit-4-estacoes",
  bambu: "vela-aromatica-bambu",
  "bambu-4": "difusor-de-ambiente-bambu",
  "bambu-3": "spray-de-ambiente-bambu",
  "difusor-de-baunilha": "difusor-de-ambiente-baunilha",
  "spray-arroma-de-baunilha": "spray-de-ambiente-baunilha",
  baunilha: "vela-aromatica-baunilha",
  "capim-limao": "vela-aromatica-capim-limao",
  "cedro-e-orvalho": "vela-aromatica-cedro-e-orvalho",
  "cereja-e-avela": "vela-aromatica-cereja-e-avela",
  "cha-branco": "vela-aromatica-cha-branco",
  "cha-branco-2": "difusor-de-ambiente-cha-branco",
  "bambu-2": "spray-de-ambiente-cha-branco",
  "citrico-frutado": "vela-aromatica-citrico-frutado",
  "spray-especiarias": "spray-de-ambiente-especiarias",
  "difusor-de-especiarias": "difusor-de-ambiente-especiarias",
  especiarias: "vela-aromatica-especiarias",
  "difusor-de-flor-de-laranjeira": "difusor-de-ambiente-flor-de-laranjeira",
  "flor-de-laranjeira": "vela-aromatica-flor-de-laranjeira",
  "spray-flor-de-laranjeira": "spray-de-ambiente-flor-de-laranjeira",
  "frutas-vermelhas": "vela-aromatica-frutas-vermelhas",
  "lavanda-2": "spray-de-ambiente-lavanda",
  lavanda: "vela-aromatica-lavanda",
  "lavanda-3": "difusor-de-ambiente-lavanda",
  "madeira-nobre": "vela-aromatica-madeira-nobre",
  "spray-noite-estralada": "spray-noite-feliz",
};
