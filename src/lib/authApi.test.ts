import { describe, expect, it, vi } from 'vitest';
import { ApiError, api, setAuthToken, setUnauthorizedHandler } from '@/lib/api';
import { requestLogin, requestNutritionistSignup } from '@/lib/authApi';
import { describeAuthError } from '@/lib/authErrors';
import { getTokenExpiry, isTokenExpired } from '@/lib/jwt';
import { describeLinkError } from '@/lib/linkErrors';
import { listPatients, unlinkPatient } from '@/lib/linksApi';
import { tokenStorage } from '@/lib/tokenStorage';
import {
  validateCrnNumber,
  validateCrnRegion,
  validateEmail,
  validateLoginPassword,
  validateName,
  validateNewPassword,
  validatePasswordConfirmation,
} from '@/lib/validators';
import { detail, fakeApi, fakeJwt, json, loginResponse } from '@/test/fakeApi';

describe('authApi', () => {
  it('login envia email e senha e devolve o token', async () => {
    const { calls } = fakeApi({ 'POST /auth/login': () => loginResponse() });

    await expect(requestLogin('ana@exemplo.com', 'senha-forte-123')).resolves.toBe('token-da-ana');
    expect(calls[0].body).toEqual({ email: 'ana@exemplo.com', senha: 'senha-forte-123' });
    expect(calls[0].headers.get('Authorization')).toBeNull();
  });

  it('cadastro envia nome, email, senha e CRN', async () => {
    const { calls } = fakeApi({
      'POST /auth/cadastro/nutricionista': () => json({ access_token: 'novo' }, 201),
    });

    const token = await requestNutritionistSignup({
      name: 'Dra. Ana',
      email: 'ana@exemplo.com',
      password: 'senha-forte-123',
      crn: 'CRN-3 12345',
    });

    expect(token).toBe('novo');
    expect(calls[0].body).toEqual({
      nome: 'Dra. Ana',
      email: 'ana@exemplo.com',
      senha: 'senha-forte-123',
      crn: 'CRN-3 12345',
    });
  });

  it('resposta sem token e um erro', async () => {
    fakeApi({ 'POST /auth/login': () => json({}) });
    await expect(requestLogin('a@b.com', 'x')).rejects.toThrow('Resposta sem token.');
  });
});

describe('jwt', () => {
  it('le o exp do token', () => {
    const token = fakeJwt(1);
    const expiry = getTokenExpiry(token)!;
    expect(Math.abs(expiry - (Date.now() + 3_600_000))).toBeLessThan(2000);
    expect(isTokenExpired(token)).toBe(false);
    expect(isTokenExpired(token, Date.now() + 2 * 3_600_000)).toBe(true);
  });

  it('token expirado', () => {
    expect(isTokenExpired(fakeJwt(-1))).toBe(true);
  });

  it('token malformado ou sem exp nao conta como expirado', () => {
    expect(getTokenExpiry('nao-e-jwt')).toBeNull();
    expect(getTokenExpiry('a.%%%.c')).toBeNull();
    expect(getTokenExpiry(`a.${btoa('"texto"')}.c`)).toBeNull();
    expect(getTokenExpiry(`a.${btoa('{"sub":"1"}')}.c`)).toBeNull();
    expect(isTokenExpired('nao-e-jwt')).toBe(false);
  });
});

describe('tokenStorage', () => {
  it('guarda, le e apaga o token', () => {
    expect(tokenStorage.get()).toBeNull();
    tokenStorage.set('abc');
    expect(tokenStorage.get()).toBe('abc');
    tokenStorage.clear();
    expect(tokenStorage.get()).toBeNull();
  });

  it('nao quebra com o armazenamento bloqueado', () => {
    const blocked = () => {
      throw new Error('bloqueado');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);

    expect(() => tokenStorage.set('abc')).not.toThrow();
    expect(tokenStorage.get()).toBeNull();
    expect(() => tokenStorage.clear()).not.toThrow();
  });
});

describe('validators', () => {
  it('email e senha do login', () => {
    expect(validateEmail('')).toBe('Informe seu e-mail.');
    expect(validateEmail('ana@exemplo')).toBe('E-mail inválido.');
    expect(validateEmail(' ana@exemplo.com ')).toBeUndefined();
    expect(validateLoginPassword('')).toBe('Informe sua senha.');
    expect(validateLoginPassword('x')).toBeUndefined();
  });

  it('cadastro', () => {
    expect(validateName('  ')).toBe('Informe seu nome completo.');
    expect(validateNewPassword('')).toBe('Crie uma senha.');
    expect(validateNewPassword('1234567')).toBe('A senha deve ter no mínimo 8 caracteres.');
    expect(validateNewPassword('12345678')).toBeUndefined();
    expect(validatePasswordConfirmation('12345678', '')).toBe('Repita a senha.');
    expect(validatePasswordConfirmation('12345678', '1234567x')).toBe('As senhas não conferem.');
    expect(validatePasswordConfirmation('12345678', '12345678')).toBeUndefined();
  });

  it('CRN', () => {
    expect(validateCrnRegion('')).toBe('Selecione a região.');
    expect(validateCrnRegion('CRN-12')).toBe('Selecione a região.');
    expect(validateCrnRegion('CRN-11')).toBeUndefined();
    expect(validateCrnNumber('')).toBe('Informe o número do registro.');
    expect(validateCrnNumber('12a')).toBe('Número de registro inválido.');
    expect(validateCrnNumber('4289/P')).toBeUndefined();
    expect(validateCrnNumber('12345')).toBeUndefined();
  });
});

describe('describeAuthError', () => {
  it.each([
    [new TypeError('Failed to fetch'), 'Não foi possível conectar ao servidor.'],
    [new ApiError(401, 'x'), 'E-mail ou senha incorretos.'],
    [new ApiError(409, ''), 'Este e-mail já está cadastrado.'],
    [new ApiError(409, '{"detail":"Email ja cadastrado"}'), 'Email ja cadastrado'],
    [new ApiError(422, '{"detail":[{"msg":"x"}]}'), 'Dados inválidos.'],
    [new ApiError(400, '{"detail":"crn invalido"}'), 'crn invalido'],
    [new ApiError(503, ''), 'O servidor está indisponível'],
    [new ApiError(418, '{"detail":"Bule"}'), 'Bule'],
    [new ApiError(418, 'texto'), 'Não foi possível concluir.'],
    ['???', 'Algo deu errado.'],
  ])('%s', (error, expected) => {
    expect(describeAuthError(error)).toContain(expected);
  });
});

describe('describeLinkError', () => {
  it.each([
    [new TypeError('Failed to fetch'), 'Não foi possível conectar'],
    [new ApiError(404, ''), 'Vínculo não encontrado.'],
    [new ApiError(500, ''), 'O servidor está indisponível'],
    [new ApiError(403, '{"detail":"Sem permissao"}'), 'Sem permissao'],
    [new ApiError(403, 'x'), 'Não foi possível concluir.'],
    [null, 'Algo deu errado.'],
  ])('%s', (error, expected) => {
    expect(describeLinkError(error)).toContain(expected);
  });
});

describe('linksApi', () => {
  it('lista pacientes convertendo os campos e manda a busca', async () => {
    const { calls } = fakeApi({
      'GET /patients': () =>
        json([
          {
            paciente_id: 7,
            nome: 'Alex',
            email: 'alex@email.com',
            status: 'ativo',
            vinculado_em: '2026-11-01T10:00:00Z',
          },
          { paciente_id: 8, nome: 'Bia', email: 'bia@email.com', status: 'pendente' },
        ]),
    });

    const patients = await listPatients('  al ex ');

    expect(calls[0].path).toBe('/patients?busca=al%20ex');
    expect(patients).toEqual([
      {
        id: 7,
        name: 'Alex',
        email: 'alex@email.com',
        status: 'ativo',
        linkedAt: '2026-11-01T10:00:00Z',
      },
      { id: 8, name: 'Bia', email: 'bia@email.com', status: 'pendente', linkedAt: null },
    ]);
  });

  it('sem busca nao manda query e resposta vazia vira lista vazia', async () => {
    const { calls } = fakeApi({ 'GET /patients': () => new Response(null, { status: 204 }) });
    await expect(listPatients()).resolves.toEqual([]);
    expect(calls[0].path).toBe('/patients');
  });

  it('desvincula com DELETE', async () => {
    const { calls } = fakeApi({ 'DELETE /patients/7': () => new Response(null, { status: 204 }) });
    await unlinkPatient(7);
    expect(calls[0].method).toBe('DELETE');
  });
});

describe('cliente HTTP', () => {
  it('injeta o token e para de mandar depois de limpar', async () => {
    const { calls } = fakeApi({ 'GET /x': () => json({ ok: true }) });

    setAuthToken('abc');
    await api.get('/x');
    setAuthToken(null);
    await api.get('/x');

    expect(calls[0].headers.get('Authorization')).toBe('Bearer abc');
    expect(calls[1].headers.get('Authorization')).toBeNull();
  });

  it('401 com token chama o handler; sem token, nao', async () => {
    fakeApi({ 'GET /x': () => detail('expirou', 401) });
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await expect(api.get('/x')).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();

    setAuthToken('abc');
    await expect(api.get('/x')).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('erro sem corpo vira ApiError com o status', async () => {
    fakeApi({ 'GET /x': () => new Response('', { status: 503 }) });
    await expect(api.get('/x')).rejects.toEqual(new ApiError(503, 'HTTP 503'));
  });

  it('PUT manda JSON; 204 e 201 sem corpo devolvem undefined', async () => {
    const { calls } = fakeApi({
      'PUT /x': () => json({ ok: true }),
      'DELETE /x': () => new Response(null, { status: 204 }),
      'POST /x': () => new Response('', { status: 201 }),
    });

    await expect(api.put('/x', { a: 1 })).resolves.toEqual({ ok: true });
    await expect(api.delete('/x')).resolves.toBeUndefined();
    await expect(api.post('/x', {})).resolves.toBeUndefined();
    expect(calls.map((c) => c.method)).toEqual(['PUT', 'DELETE', 'POST']);
    expect(calls[0].headers.get('Content-Type')).toBe('application/json');
    expect(calls[1].headers.get('Content-Type')).toBeNull();
  });
});
