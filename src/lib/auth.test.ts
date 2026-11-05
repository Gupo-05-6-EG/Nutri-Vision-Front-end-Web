import { describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '@/lib/api';
import { NotNutritionistError, login, logout, restoreSession } from '@/lib/auth';
import { fakeApi, json, loginResponse, nutritionist } from '@/test/fakeApi';

const STORAGE_KEY = 'nutrivision.session';

describe('login', () => {
  it('guarda a sessao e passa a mandar o token', async () => {
    const { calls } = fakeApi({
      'POST /auth/login': () => loginResponse(),
      'GET /auth/me': () => json(nutritionist),
    });

    const session = await login('ana@exemplo.com', 'senha-forte-123');
    await api.get('/auth/me');

    expect(session.user).toEqual(nutritionist);
    expect(calls[0].body).toEqual({ email: 'ana@exemplo.com', senha: 'senha-forte-123' });
    expect(calls[0].headers.get('Authorization')).toBeNull();
    expect(calls[1].headers.get('Authorization')).toBe('Bearer token-da-ana');
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY)!).token).toBe('token-da-ana');
  });

  it('recusa paciente sem guardar sessao', async () => {
    fakeApi({
      'POST /auth/login': () => loginResponse({ ...nutritionist, perfil: 'paciente' } as never),
    });

    await expect(login('p@exemplo.com', 'x')).rejects.toBeInstanceOf(NotNutritionistError);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('propaga o 401 da API', async () => {
    fakeApi({ 'POST /auth/login': () => json({ detail: 'Email ou senha invalidos' }, 401) });
    await expect(login('a@b.com', 'errada')).rejects.toMatchObject({ status: 401 });
  });

  it('funciona mesmo sem sessionStorage disponivel', async () => {
    fakeApi({ 'POST /auth/login': () => loginResponse() });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    await expect(login('ana@exemplo.com', 'x')).resolves.toMatchObject({ token: 'token-da-ana' });
  });
});

describe('restoreSession e logout', () => {
  it('restaura a sessao valida e reinjeta o token', async () => {
    fakeApi({ 'POST /auth/login': () => loginResponse() });
    await login('ana@exemplo.com', 'x');
    const { calls } = fakeApi({ 'GET /health': () => json({ status: 'ok' }) });

    expect(restoreSession()?.user.nome).toBe('Dra. Ana');
    await api.get('/health');
    expect(calls[0].headers.get('Authorization')).toBe('Bearer token-da-ana');
  });

  it('descarta sessao expirada', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: 't', expiresAt: '2000-01-01T00:00:00Z', user: nutritionist }),
    );

    expect(restoreSession()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ignora conteudo corrompido', () => {
    sessionStorage.setItem(STORAGE_KEY, '{nao e json');
    expect(restoreSession()).toBeNull();
  });

  it('sem nada salvo nao ha sessao', () => {
    expect(restoreSession()).toBeNull();
  });

  it('logout apaga a sessao e para de mandar o token', async () => {
    fakeApi({ 'POST /auth/login': () => loginResponse() });
    await login('ana@exemplo.com', 'x');
    logout();
    const { calls } = fakeApi({ 'GET /health': () => json({}) });

    await api.get('/health');

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(restoreSession()).toBeNull();
    expect(calls[0].headers.get('Authorization')).toBeNull();
  });
});

describe('cliente HTTP', () => {
  it('erro sem corpo vira ApiError com o status', async () => {
    fakeApi({ 'GET /x': () => new Response('', { status: 503 }) });
    await expect(api.get('/x')).rejects.toEqual(new ApiError(503, 'HTTP 503'));
  });

  it('204 devolve undefined e PUT/DELETE usam o metodo certo', async () => {
    const { calls } = fakeApi({
      'PUT /x': () => json({ ok: true }),
      'DELETE /x': () => new Response(null, { status: 204 }),
    });

    await expect(api.put('/x', { a: 1 })).resolves.toEqual({ ok: true });
    await expect(api.delete('/x')).resolves.toBeUndefined();
    expect(calls.map((c) => c.method)).toEqual(['PUT', 'DELETE']);
    expect(calls[0].headers.get('Content-Type')).toBe('application/json');
    expect(calls[1].headers.get('Content-Type')).toBeNull();
  });
});
