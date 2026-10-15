import { IsOptional, Matches } from 'class-validator';

// Body opcional de POST /pedidos/:id/etiqueta. Sem a chave da NF-e, a
// etiqueta vai com declaração de conteúdo — a Jadlog no PR recusa esse
// caminho e o serviço exige a chave (44 dígitos) antes de chamar a API.
export class GerarEtiquetaDto {
  @IsOptional()
  @Matches(/^\d{44}$/, {
    message: 'A chave da NF-e deve ter 44 dígitos.',
  })
  chaveNotaFiscal?: string;
}
