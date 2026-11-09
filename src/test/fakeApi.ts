/**
 * API falsa para os testes de componente: substitui o `fetch` global e
 * responde por rota (`METODO /caminho`), guardando cada chamada.
 */

import { vi } from 'vitest';

export interface Call {
  method: string;
  path: string;
  body: unknown;
  headers: Headers;
}

type Handler = (call: Call) => Response | Promise<Response>;

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const detail = (text: string, status: number) => json({ detail: text }, status);

const API = 'http://api.test/api/v1';

export function fakeApi(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const path = url.href.slice(API.length).split('?')[0];
    const call: Call = {
      method: init.method ?? 'GET',
      path: path + url.search,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: new Headers(init.headers),
    };
    calls.push(call);
    const handler = routes[`${call.method} ${path}`];
    if (!handler) return detail(`Rota sem handler no teste: ${call.method} ${path}`, 404);
    return handler(call);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export const nutritionist = {
  id: 10,
  nome: 'Dra. Ana',
  email: 'ana@exemplo.com',
  perfil: 'nutricionista' as const,
  crn: 'CRN-3 12345',
};

/** JWT falso com `exp` daqui a [hours] horas (negativo = ja expirado). */
export function fakeJwt(hours = 24, sub = '10'): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + Math.round(hours * 3600);
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, exp })}.assinatura`;
}

export const loginResponse = (user = nutritionist, hours = 24) =>
  json({
    access_token: 'token-da-ana',
    token_type: 'bearer',
    expira_em: new Date(Date.now() + hours * 3_600_000).toISOString(),
    usuario: user,
  });

export const arroz = {
  id: 3,
  nome: 'Arroz, tipo 1, cozido',
  categoria: 'Cereais e derivados',
  kcal_100g: 128,
  carbs_100g: 28.1,
  prot_100g: 2.5,
  gord_100g: 0.2,
};

export const frango = {
  id: 411,
  nome: 'Frango, peito, sem pele, grelhado',
  categoria: 'Carnes e derivados',
  kcal_100g: 159,
  carbs_100g: 0,
  prot_100g: 32,
  gord_100g: 2.5,
};
