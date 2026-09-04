import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Etapa 8.11 (complemento — IP real no throttling atrás do Render) —
// substitui só a identificação do "tracker" usado pelo ThrottlerGuard
// (por padrão, req.ip — ver @nestjs/throttler/dist/throttler.guard.js).
//
// Por quê não X-Forwarded-For/req.ips: o próprio Render confirma
// publicamente que não limpa nem reseta um X-Forwarded-For que o cliente
// já tenha enviado — só acrescenta os hops dele ao final da lista (ver
// feedback.render.com/features/p/send-the-correct-xforwardedfor). Isso
// significa que a primeira posição da lista pode ser um valor forjado
// pelo próprio cliente, então nunca é usada aqui.
//
// Por quê CF-Connecting-IP: todo o tráfego de entrada do Render passa
// primeiro pelo Cloudflare antes de chegar à aplicação (ver
// render.com/articles/how-render-handles-ddos-attacks). CF-Connecting-IP é
// um header que só o próprio Cloudflare define — a borda do Cloudflare
// sempre sobrescreve qualquer valor que o cliente tente enviar com esse
// mesmo nome, diferente do X-Forwarded-For. Por isso é confiável dentro do
// ambiente real do Render.
//
// Por quê o gate por NODE_ENV === 'production': fora desse ambiente (dev
// local, testes, ou uma hospedagem futura sem Cloudflare), nada garante
// que CF-Connecting-IP não seja um valor forjado pelo próprio cliente — o
// Express não tem como distinguir, só pelo header, se ele veio realmente
// do Cloudflare. Por isso o header é IGNORADO por completo fora de
// produção, e o tracker cai sempre para req.ip (mesmo comportamento atual,
// sem alterar trust proxy).
@Injectable()
export class CloudflareAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (process.env.NODE_ENV === 'production') {
      const cfConnectingIp = req.headers?.['cf-connecting-ip'];
      if (typeof cfConnectingIp === 'string' && cfConnectingIp.length > 0) {
        return cfConnectingIp;
      }
    }

    return req.ip;
  }
}
