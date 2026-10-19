import { BadRequestException } from '@nestjs/common';

// Raio de atendimento da loja: só entrega a até 100 km de Curitiba
// (centro). Quem está fora não cotiza frete nem cria sessão de checkout —
// a mensagem é pensada para aparecer na tela (BadRequestException 400,
// AllExceptionsFilter já a devolve em `message`).
export const RAIO_ENTREGA_KM = 100;

// Centro de Curitiba, próximo ao endereço da loja (Rua Ébano Pereira, 11).
// Um deslocamento de 1–2 km não muda quem entra ou sai de um raio de 100 km.
export const ORIGEM_ENTREGA = {
  lat: -25.4284,
  lng: -49.2733,
} as const;

export const CODIGO_ERRO_AREA_ENTREGA = 'AREA_ENTREGA_FORA_DO_RAIO';

export const MENSAGEM_FORA_DA_AREA =
  'Por enquanto entregamos apenas em Curitiba e região.';

export class AreaEntregaForaDoRaioError extends BadRequestException {
  constructor() {
    super({
      message: MENSAGEM_FORA_DA_AREA,
      code: CODIGO_ERRO_AREA_ENTREGA,
    });
  }
}

export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface AreaEntregaOpcoes {
  fetchFn?: typeof fetch;
  raioKm?: number;
}

// Cache em memória: o mesmo CEP não muda de lugar, e a cotação dispara
// sempre que o cliente troca de endereço no checkout. `null` = consultado
// e sem coordenadas (não fica tentando a API a cada clique).
const cacheCoords = new Map<string, Coordenadas | null>();

export function limparCacheAreaEntrega(): void {
  cacheCoords.clear();
}

export function normalizarCep(cep: string): string {
  return cep.replace(/\D/g, '');
}

// Curitiba propriamente dita (faixa oficial dos Correios): 80000–82999.
// Caminho rápido — não depende de geocodificação.
export function cepDeCuritiba(cep: string): boolean {
  const prefixo = Number(normalizarCep(cep).slice(0, 5));
  return prefixo >= 80000 && prefixo <= 82999;
}

// Região Metropolitana + litoral próximo (Paranaguá 832xx). Fallback só
// quando a geocodificação falha: quase todos esses CEPs estão a menos de
// 100 km; Ponta Grossa (84xxx) e o resto do Paraná ficam de fora.
export function cepMetropolitanoProvavel(cep: string): boolean {
  const prefixo = Number(normalizarCep(cep).slice(0, 5));
  return prefixo >= 83000 && prefixo <= 83899;
}

// Cidades fora do raio de 100 km de Curitiba, mas com entrega habilitada
// (faixas oficiais dos Correios por município).
const FAIXAS_CEP_CIDADES_ATENDIDAS: ReadonlyArray<{
  min: number;
  max: number;
}> = [
  { min: 13000, max: 13139 }, // Campinas/SP
  { min: 86000, max: 86099 }, // Londrina/PR
  { min: 86990, max: 86999 }, // Marialva/PR
  { min: 60000, max: 60999 }, // Fortaleza/CE
];

export function cepEmCidadeAtendida(cep: string): boolean {
  const prefixo = Number(normalizarCep(cep).slice(0, 5));
  return FAIXAS_CEP_CIDADES_ATENDIDAS.some(
    ({ min, max }) => prefixo >= min && prefixo <= max,
  );
}

export function distanciaKm(origem: Coordenadas, destino: Coordenadas): number {
  const raioTerraKm = 6371;
  const dLat = paraRadiano(destino.lat - origem.lat);
  const dLng = paraRadiano(destino.lng - origem.lng);
  const senLat = Math.sin(dLat / 2);
  const senLng = Math.sin(dLng / 2);
  const h =
    senLat * senLat +
    Math.cos(paraRadiano(origem.lat)) *
      Math.cos(paraRadiano(destino.lat)) *
      senLng *
      senLng;
  return 2 * raioTerraKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

function paraRadiano(graus: number): number {
  return (graus * Math.PI) / 180;
}

// Chamado em cotarFrete e createSession (via cotarOpcoes): se o CEP está
// fora do raio, lança antes de qualquer chamada ao Melhor Envio.
export async function garantirCepNaAreaDeEntrega(
  cep: string,
  opcoes: AreaEntregaOpcoes = {},
): Promise<void> {
  const cepDigitos = normalizarCep(cep);
  if (cepDigitos.length !== 8) {
    throw new BadRequestException('CEP de entrega inválido.');
  }

  if (cepDeCuritiba(cepDigitos)) {
    return;
  }

  if (cepEmCidadeAtendida(cepDigitos)) {
    return;
  }

  const raioKm = opcoes.raioKm ?? RAIO_ENTREGA_KM;
  const coords = await geocodificarCep(cepDigitos, opcoes.fetchFn);

  if (coords) {
    if (distanciaKm(ORIGEM_ENTREGA, coords) > raioKm) {
      throw new AreaEntregaForaDoRaioError();
    }
    return;
  }

  if (cepMetropolitanoProvavel(cepDigitos)) {
    return;
  }

  throw new AreaEntregaForaDoRaioError();
}

async function geocodificarCep(
  cepDigitos: string,
  fetchFn?: typeof fetch,
): Promise<Coordenadas | null> {
  if (cacheCoords.has(cepDigitos)) {
    return cacheCoords.get(cepDigitos) ?? null;
  }

  const requisitar = fetchFn ?? globalThis.fetch.bind(globalThis);
  const coords =
    (await geocodificarAwesomeApi(cepDigitos, requisitar)) ??
    (await geocodificarBrasilApi(cepDigitos, requisitar));

  cacheCoords.set(cepDigitos, coords);
  return coords;
}

async function geocodificarAwesomeApi(
  cepDigitos: string,
  requisitar: typeof fetch,
): Promise<Coordenadas | null> {
  const dados = await getJson(
    `https://cep.awesomeapi.com.br/json/${cepDigitos}`,
    requisitar,
  );
  if (!dados || typeof dados !== 'object') {
    return null;
  }
  return parseCoordenadas(
    (dados as { lat?: unknown }).lat,
    (dados as { lng?: unknown }).lng,
  );
}

async function geocodificarBrasilApi(
  cepDigitos: string,
  requisitar: typeof fetch,
): Promise<Coordenadas | null> {
  const dados = await getJson(
    `https://brasilapi.com.br/api/cep/v2/${cepDigitos}`,
    requisitar,
  );
  if (!dados || typeof dados !== 'object') {
    return null;
  }
  const location = (dados as { location?: { coordinates?: unknown } })
    .location;
  const coordinates = location?.coordinates;
  if (!coordinates || typeof coordinates !== 'object') {
    return null;
  }
  return parseCoordenadas(
    (coordinates as { latitude?: unknown }).latitude,
    (coordinates as { longitude?: unknown }).longitude,
  );
}

function parseCoordenadas(
  latBruta: unknown,
  lngBruta: unknown,
): Coordenadas | null {
  const lat = Number(latBruta);
  const lng = Number(lngBruta);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

async function getJson(
  url: string,
  requisitar: typeof fetch,
): Promise<unknown | null> {
  try {
    const response = await requisitar(url, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}
