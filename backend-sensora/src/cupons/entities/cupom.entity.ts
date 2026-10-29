import { PublicoCupom } from '../enums/publico-cupom.enum';
import { TipoDescontoCupom } from '../enums/tipo-desconto-cupom.enum';

export class CupomClienteResumo {
  id: number;
  nome: string;
  email: string;
}

export class CupomResposta {
  id: number;
  codigo: string;
  mensagem: string;
  tipoDesconto: TipoDescontoCupom;
  valor: number;
  publico: PublicoCupom;
  ativo: boolean;
  mostrarNoTopo: boolean;
  valorMinimo: number | null;
  limiteUsos: number | null;
  usos: number;
  inicioEm: Date | null;
  fimEm: Date | null;
  usuarios: CupomClienteResumo[];
}

export class FaixaCupom {
  codigo: string;
  mensagem: string;
  tipoDesconto: TipoDescontoCupom;
  valor: number;
}

export class CupomAplicado {
  cupomId: number;
  codigo: string;
  desconto: number;
  mensagem: string;
}
