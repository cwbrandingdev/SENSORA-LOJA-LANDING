// Etapa 6.5 (Frete) — mesmo padrão de services/checkout.ts: instância `api`
// (Authorization automático via interceptor), sem nenhuma lógica de
// cálculo aqui. O backend é a única autoridade sobre CEP de origem,
// peso/dimensão e preço final (ver CheckoutService.cotarFrete/
// MelhorEnvioService) — este service só encaminha produtoId+quantidade+
// enderecoId e devolve a lista de opções para o cliente escolher.
import api from "./api";
import type { CotarFretePayload, OpcaoFrete } from "@/lib/types/loja";

export async function cotarFrete(data: CotarFretePayload): Promise<OpcaoFrete[]> {
  const response = await api.post<OpcaoFrete[]>("/checkout/frete/cotacao", data);
  return response.data;
}
