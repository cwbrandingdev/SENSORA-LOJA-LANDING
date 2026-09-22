import { StatusFiscal } from '../enums/status-fiscal.enum';

// Infraestrutura Fiscal (preparação arquitetural) — forma completa,
// equivalente ao model Prisma (ver schema.prisma#NotaFiscal), usada
// internamente pelo FiscalService. Nenhum controller serializa esta classe
// inteira nesta etapa (ver NotaFiscalResumo, abaixo, para o que de fato sai
// pela API) — existe para dar um tipo de retorno estável aos métodos do
// service, independente do tipo gerado pelo Prisma.
export class NotaFiscal {
  id: number;
  pedidoId: number;
  status: StatusFiscal;

  numero?: string | null;
  serie?: string | null;
  chaveAcesso?: string | null;
  protocolo?: string | null;

  xmlUrl?: string | null;
  pdfUrl?: string | null;

  mensagemErro?: string | null;
  tentativas: number;

  // Snapshot fiscal — ver comentário completo no model Prisma. Campo
  // `destinatarioDocumento` é neutro (CPF ou CNPJ, sem distinção aqui).
  destinatarioNome?: string | null;
  destinatarioDocumento?: string | null;
  destinatarioEmail?: string | null;
  enderecoCep?: string | null;
  enderecoRua?: string | null;
  enderecoNumero?: string | null;
  enderecoComplemento?: string | null;
  enderecoBairro?: string | null;
  enderecoCidade?: string | null;
  enderecoEstado?: string | null;

  criadoEm: Date;
  atualizadoEm: Date;
  emitidoEm?: Date | null;
}

// Infraestrutura Fiscal — subconjunto pensado para acompanhar o Pedido no
// detalhe (ver PedidosService.findOne/pedido.entity.ts): só o que identifica
// o documento e seu status, nunca o snapshot do destinatário (redundante com
// o próprio Pedido/Usuario) nem diagnóstico interno (mensagemErro/
// tentativas/xmlUrl/pdfUrl) — o que sai por aqui é deliberadamente mínimo;
// ampliar fica para quando a emissão real existir e ficar claro o que a
// tela precisa mostrar.
export class NotaFiscalResumo {
  id: number;
  status: StatusFiscal;
  numero?: string | null;
  serie?: string | null;
  chaveAcesso?: string | null;
  emitidoEm?: Date | null;
}
