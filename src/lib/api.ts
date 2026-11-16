/**
 * Cliente HTTP da API do Nutri Vision.
 *
 * O token JWT entra aqui na Task 1.2 — por isso o `authToken` já é um ponto
 * único de injeção, em vez de cada chamada montar seus próprios headers.
 */

import { env } from '@/lib/env';

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Chamado quando a API responde 401 *com um token em uso* (sessão expirada ou
 * invalidada). Não dispara em 401 sem token (ex.: senha errada no login).
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  const response = await fetch(`${env.apiUrl}${path}`, { ...init, headers });

  if (!response.ok) {
    if (response.status === 401 && authToken) unauthorizedHandler?.();
    const detail = await response.text().catch(() => '');
    throw new ApiError(response.status, detail || `HTTP ${response.status}`);
  }

  // 204 e respostas sem corpo (ex.: 201 do cadastro) não têm JSON para ler.
  const text = response.status === 204 ? '' : await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface HealthResponse {
  status: string;
  service: string;
  environment: string;
}

export const getHealth = () => api.get<HealthResponse>('/health');

export async function downloadPdf(path: string): Promise<Blob> {
  const headers = new Headers({ Accept: 'application/pdf' });
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  const response = await fetch(`${env.apiUrl}${path}`, { headers });
  if (!response.ok) {
    if (response.status === 401 && authToken) unauthorizedHandler?.();
    throw new ApiError(response.status, 'Falha ao exportar relat�rio');
  }
  if (!response.headers.get('Content-Type')?.includes('application/pdf')) {
    throw new Error('Resposta inesperada do servidor');
  }
  return response.blob();
}
