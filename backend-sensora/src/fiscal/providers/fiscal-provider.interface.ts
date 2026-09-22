import { StatusFiscal } from '../enums/status-fiscal.enum';

// Infraestrutura Fiscal (preparação arquitetural) — abstração do PROVEDOR
// fiscal, análoga em espírito a AsaasService/MelhorEnvioService (um cliente
// fino, isolado, que a camada de negócio chama sem conhecer detalhes da API
// externa) — com uma diferença deliberada: aqui é uma INTERFACE, não uma
// classe concreta. Nenhum provedor real é escolhido nesta etapa (ver
// restrições da tarefa), então não existe nenhuma implementação desta
// interface no código hoje — FiscalService injeta um FiscalProvider
// opcionalmente (ver FISCAL_PROVIDER/@Optional em fiscal.service.ts) e se
// comporta como "não configurado" enquanto isso for verdade, mesmo padrão
// preguiçoso já usado por AsaasService.isConfigured()/ImagekitService.
//
// Deliberadamente neutro: nenhum campo aqui assume NF-e vs NFC-e, nenhum
// item carrega NCM/CFOP/CST/CSOSN/impostos — "descricao"/"valorUnitario" são
// só o suficiente para identificar o que foi vendido, sem modelar regra
// tributária nenhuma. A forma definitiva do payload de emissão (o que o
// provedor escolhido realmente exige) fica para quando essa escolha
// acontecer.

// Espelha o snapshot persistido em NotaFiscal (ver entities/nota-fiscal.
// entity.ts) — o formato de entrada de emitir() é o mesmo formato que
// FiscalService já sabe montar a partir do Pedido, sem reinterpretação.
export interface FiscalDestinatario {
  nome: string;
  documento?: string;
  email?: string;
  endereco?: {
    cep: string;
    rua: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
}

export interface FiscalItem {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}

export interface FiscalEmissaoInput {
  pedidoId: number;
  destinatario: FiscalDestinatario;
  itens: FiscalItem[];
  valorTotal: number;
}

// Resultado de uma emissão aceita pelo provedor — todos os campos formam o
// que FiscalService gravaria de volta em NotaFiscal (numero/serie/
// chaveAcesso/protocolo/xmlUrl/pdfUrl), nunca interpretados ou validados
// quanto a formato/regra fiscal por esta camada.
export interface FiscalEmissaoResultado {
  numero?: string;
  serie?: string;
  chaveAcesso?: string;
  protocolo?: string;
  xmlUrl?: string;
  pdfUrl?: string;
}

export interface FiscalStatusConsultado {
  status: StatusFiscal;
  mensagemErro?: string;
}

// Contrato mínimo que um futuro provedor concreto precisa implementar.
// `referencia` em consultarStatus/cancelar é deliberadamente genérico (ex.:
// chaveAcesso ou protocolo, a critério de quem implementar) — não é papel
// desta interface decidir qual identificador o provedor escolhido usa.
export interface FiscalProvider {
  emitir(input: FiscalEmissaoInput): Promise<FiscalEmissaoResultado>;
  consultarStatus(referencia: string): Promise<FiscalStatusConsultado>;
  cancelar(referencia: string, motivo?: string): Promise<void>;
}

// Token de injeção — permite ao Nest resolver um FiscalProvider opcional
// (ver @Optional() em FiscalService) sem exigir nenhuma classe concreta
// registrada em FiscalModule nesta etapa.
export const FISCAL_PROVIDER = Symbol('FISCAL_PROVIDER');
