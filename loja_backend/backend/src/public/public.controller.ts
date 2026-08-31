import { Controller, Get, Param } from '@nestjs/common';
import { CategoriaPublica } from './entities/categoria-publica.entity';
import { ProdutoPublico } from './entities/produto-publico.entity';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('produtos')
  listarProdutos(): Promise<ProdutoPublico[]> {
    return this.publicService.listarProdutos();
  }

  @Get('produtos/:slug')
  buscarProdutoPorSlug(@Param('slug') slug: string): Promise<ProdutoPublico> {
    return this.publicService.buscarProdutoPorSlug(slug);
  }

  @Get('categorias')
  listarCategorias(): Promise<CategoriaPublica[]> {
    return this.publicService.listarCategorias();
  }
}
