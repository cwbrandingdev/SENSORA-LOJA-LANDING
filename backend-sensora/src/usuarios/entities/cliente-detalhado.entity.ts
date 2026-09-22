import { Endereco } from '../../enderecos/entities/endereco.entity';
import { StatusPedido } from '../../pedidos/enums/status-pedido.enum';

// Fase B (Admin/Clientes reais) — shape de leitura para o detalhe
// administrativo de um cliente (Usuario com perfil CLIENTE), construído em
// cima das relações Usuario -> Pedido / Usuario -> Endereco já existentes
// no schema (nenhuma migration necessária). Lista campo a campo, nunca um
// spread de Usuario/UsuarioPrisma: mesmo princípio de segurança já usado em
// UsuarioPublico (usuario.entity.ts) — senha/hashes/refresh tokens nunca
// chegam perto desta classe. Ver UsuariosService.buscarDetalheCliente.
export class PedidoResumoCliente {
  id: number;
  numero: string;
  data: Date;
  status: StatusPedido;
  total: number;
}

export class ResumoPedidosCliente {
  quantidadePedidos: number;
  // Soma de Pedido.total só entre os PAGO — mesmo critério já usado no card
  // "Faturamento" do Dashboard (frontend app/workspace-x/page.tsx).
  totalComprado: number;
  // Data do pedido mais recente do cliente, independente do status
  // (`pedidos` já vem ordenado por data desc). `null` quando o cliente
  // nunca fez nenhum pedido.
  ultimoPedidoEm: Date | null;
}

export class ClienteDetalhado {
  id: number;
  nome: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  ativo: boolean;
  emailVerificado: boolean;
  enderecos: Endereco[];
  pedidos: PedidoResumoCliente[];
  resumo: ResumoPedidosCliente;
}
