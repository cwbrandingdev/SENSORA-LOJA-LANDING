import { NotaFiscalResumo } from '../../fiscal/entities/nota-fiscal.entity';
import { StatusEnvio } from '../enums/status-envio.enum';
import { StatusPedido } from '../enums/status-pedido.enum';

export class Pedido {
  id: number;
  numero: string;
  data: Date;
  status: StatusPedido;
  total: number;

  // Etapa 6.5 (Frete) — snapshot do endereço de entrega e do frete
  // escolhido/validado nesta compra (ver CheckoutService.createSession).
  // Opcionais: pedidos criados antes desta etapa não têm esses dados.
  enderecoCep?: string;
  enderecoRua?: string;
  enderecoNumero?: string;
  enderecoComplemento?: string;
  enderecoBairro?: string;
  enderecoCidade?: string;
  enderecoEstado?: string;
  freteValor?: number;
  freteTransportadora?: string;
  freteServico?: string;
  fretePrazoDias?: number;

  // Etapa 6.6 (Status de Envio) — eixo logístico, independente de `status`
  // (financeiro/Asaas). `statusEnvio` sempre presente (default NAO_ENVIADO
  // no schema); `enviadoEm` só é preenchido quando `statusEnvio === ENVIADO`.
  statusEnvio: StatusEnvio;
  enviadoEm?: Date;

  // Infraestrutura Fiscal (preparação arquitetural) — só populado por
  // PedidosService.findOne (a única query que faz `include: { notaFiscal:
  // true }` hoje, ver comentário lá). `undefined` nos demais métodos deste
  // service (cancelar/solicitarReembolso/marcarComoEnviado/update) não
  // significa "sem nota fiscal", só que aquela chamada específica não
  // carregou a relação — `null` é o valor real de "pedido sem nota fiscal
  // ainda" (o único caso possível hoje, já que nenhum código cria
  // NotaFiscal automaticamente nesta etapa).
  notaFiscal?: NotaFiscalResumo | null;
}
