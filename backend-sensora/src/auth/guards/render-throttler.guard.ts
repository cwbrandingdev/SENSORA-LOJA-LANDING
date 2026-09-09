import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { BlockList, isIPv4, isIPv6 } from 'net';

// Etapa 8.11 (complemento — IP real no throttling atrás do Render) —
// substitui só a identificação do "tracker" usado pelo ThrottlerGuard (por
// padrão, req.ip — ver @nestjs/throttler/dist/throttler.guard.js).
//
// Por quê não X-Forwarded-For/req.ips: o próprio Render confirma
// publicamente que não limpa nem reseta um X-Forwarded-For que o cliente
// já tenha enviado — só acrescenta os hops dele ao final da lista (ver
// feedback.render.com/features/p/send-the-correct-xforwardedfor). Isso
// significa que a primeira posição da lista pode ser um valor forjado
// pelo próprio cliente, então nunca é usada aqui.
//
// Etapa 10 / CFG-02 (achado da auditoria): CF-Connecting-IP só é um header
// confiável enquanto a conexão realmente passar pelo Cloudflare — nada no
// header em si prova isso. Um cliente que alcance a aplicação diretamente
// (contornando o Cloudflare) pode enviar qualquer valor nesse header
// também, escolhendo seu próprio "bucket" de rate limit. Por isso, antes
// de confiar em CF-Connecting-IP, validamos que o IP da CONEXÃO TCP em si
// (req.socket.remoteAddress — nunca um header, portanto não forjável pelo
// cliente) pertence aos ranges oficialmente publicados pelo Cloudflare
// (cloudflare.com/ips-v4, cloudflare.com/ips-v6). Só quando essa origem é
// confirmada é que o header passa a ser usado como tracker; caso
// contrário, cai no mesmo fallback seguro de sempre (req.ip) — exatamente
// como já acontecia quando o header estava simplesmente ausente.
//
// Limitação residual conhecida (infraestrutura, não código — ver relatório
// da Fase 9.3.1/CFG-02): se o Render intermediar a conexão através de um
// proxy interno próprio antes de alcançar o container da aplicação,
// req.socket.remoteAddress refletiria o IP interno do Render, não o do
// Cloudflare — nesse caso a validação abaixo nunca confirmaria a origem, e
// o tracker cairia sempre para req.ip. Isso é uma falha SEGURA (nunca passa
// a confiar cegamente no header), mas pode deixar de aproveitar
// CF-Connecting-IP mesmo em tráfego legítimo. Só é verificável observando o
// valor real de req.socket.remoteAddress em produção (ex.: log temporário
// de uma requisição real) ou confirmando com o suporte do Render — ver
// EXTRA_TRUSTED_PROXY_RANGES abaixo para incorporar, sem alterar código,
// qualquer range adicional que vier a ser confirmado como parte legítima
// do caminho Cloudflare → Render.
//
// Por quê o gate por NODE_ENV === 'production': fora desse ambiente (dev
// local, testes, ou uma hospedagem futura sem Cloudflare), nada garante
// qualquer relação entre a rede local e os ranges do Cloudflare — exigir
// isso quebraria localhost/CI. Por isso toda a checagem de origem (e o
// próprio CF-Connecting-IP) continua ignorada por completo fora de
// produção, e o tracker cai sempre para req.ip — comportamento local
// inalterado.

// https://www.cloudflare.com/ips-v4 (snapshot desta correção — CFG-02).
const RANGES_CLOUDFLARE_IPV4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];

// https://www.cloudflare.com/ips-v6 (snapshot desta correção — CFG-02).
const RANGES_CLOUDFLARE_IPV6 = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

// Vazio por padrão — existe só para permitir, via configuração (sem
// alterar/redeployar código), incorporar o range interno do Render como
// origem confiável, uma vez confirmado (ver limitação residual acima).
// Formato: CIDRs separados por vírgula, ex. "1.2.3.0/24,2001:db8::/32".
function rangesExtrasConfigurados(): string[] {
  const valor = process.env.EXTRA_TRUSTED_PROXY_RANGES;
  if (!valor) return [];
  return valor
    .split(',')
    .map((range) => range.trim())
    .filter((range) => range.length > 0);
}

function construirListaDeOrigensConfiaveis(): BlockList {
  const lista = new BlockList();

  for (const cidr of RANGES_CLOUDFLARE_IPV4) {
    const [endereco, prefixo] = cidr.split('/');
    lista.addSubnet(endereco, Number(prefixo), 'ipv4');
  }
  for (const cidr of RANGES_CLOUDFLARE_IPV6) {
    const [endereco, prefixo] = cidr.split('/');
    lista.addSubnet(endereco, Number(prefixo), 'ipv6');
  }
  for (const cidr of rangesExtrasConfigurados()) {
    const [endereco, prefixo] = cidr.split('/');
    if (!endereco || !prefixo) continue;
    lista.addSubnet(endereco, Number(prefixo), isIPv6(endereco) ? 'ipv6' : 'ipv4');
  }

  return lista;
}

// Construída uma única vez no carregamento do módulo — os ranges são
// estáticos (o próprio Cloudflare os publica como referência estável),
// então recalcular a cada requisição seria desperdício sem nenhum ganho.
const ORIGENS_CONFIAVEIS = construirListaDeOrigensConfiaveis();

// "::ffff:1.2.3.4" (forma IPv4-mapeada, comum em sockets dual-stack)
// precisa virar "1.2.3.4" antes da checagem — sem isso, uma conexão IPv4
// legítima nesse formato seria tratada como IPv6 e nunca bateria com
// nenhum range (IPv4) do Cloudflare.
const PREFIXO_IPV4_MAPEADO = '::ffff:';
function normalizarIp(ip: string): string {
  return ip.startsWith(PREFIXO_IPV4_MAPEADO)
    ? ip.slice(PREFIXO_IPV4_MAPEADO.length)
    : ip;
}

function origemEhConfiavel(ipConexao: string | undefined): boolean {
  if (!ipConexao) return false;

  const ip = normalizarIp(ipConexao);
  if (isIPv4(ip)) return ORIGENS_CONFIAVEIS.check(ip, 'ipv4');
  if (isIPv6(ip)) return ORIGENS_CONFIAVEIS.check(ip, 'ipv6');
  return false;
}

@Injectable()
export class CloudflareAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (process.env.NODE_ENV === 'production') {
      // IP da conexão TCP em si, nunca um header — não pode ser forjado
      // pelo cliente. req.ip como fallback só para robustez caso req.socket
      // não esteja presente (não deveria faltar numa requisição HTTP real).
      const ipConexao: string | undefined = req.socket?.remoteAddress ?? req.ip;

      if (origemEhConfiavel(ipConexao)) {
        const cfConnectingIp = req.headers?.['cf-connecting-ip'];
        if (typeof cfConnectingIp === 'string' && cfConnectingIp.length > 0) {
          return cfConnectingIp;
        }
      }
    }

    return req.ip;
  }
}
