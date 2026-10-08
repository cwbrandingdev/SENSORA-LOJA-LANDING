import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Health check do Fly (fly.toml) e do monitor de uptime: só confirma que
  // o processo subiu e responde. Sem rate limit (chamado a cada poucos
  // segundos) e sem consultar o banco (uma oscilação do banco não deve
  // tirar a máquina do ar).
  @SkipThrottle()
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
