// Etapa 6.5 (Frete) — resposta de POST /checkout/frete/cotacao. Só o
// necessário para o checkout exibir e o cliente escolher (nunca tokens/
// credenciais/dados internos do Melhor Envio, ver MelhorEnvioService).
export class OpcaoFreteResponse {
  id: number;
  transportadora: string;
  servico: string;
  preco: number;
  prazoDias: number;
}
