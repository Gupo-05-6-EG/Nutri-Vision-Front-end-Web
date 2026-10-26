/**
 * Login do nutricionista no painel (RF13).
 *
 * Versão mínima para o construtor de planos poder chamar as rotas protegidas:
 * guarda o token na `sessionStorage` (some ao fechar a aba) e o injeta no
 * cliente HTTP. Cadastro e recuperação de senha ficam para a tela de login
 * definitiva.
 */

import { api, setAuthToken } from '@/lib/api';

export interface SessionUser {
  id: number;
  nome: string;
  email: string;
  perfil: 'paciente' | 'nutricionista';
  crn: string | null;
}

interface LoginResponse {
  access_token: string;
  expira_em: string;
  usuario: SessionUser;
}

export interface Session {
  token: string;
  expiresAt: string;
  user: SessionUser;
}

const STORAGE_KEY = 'nutrivision.session';

export class NotNutritionistError extends Error {
  constructor() {
    super('O painel é exclusivo para nutricionistas.');
    this.name = 'NotNutritionistError';
  }
}

export async function login(email: string, senha: string): Promise<Session> {
  const response = await api.post<LoginResponse>('/auth/login', { email, senha });
  if (response.usuario.perfil !== 'nutricionista') throw new NotNutritionistError();
  const session = {
    token: response.access_token,
    expiresAt: response.expira_em,
    user: response.usuario,
  };
  saveSession(session);
  return session;
}

function saveSession(session: Session): void {
  setAuthToken(session.token);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Sem storage (aba privada, bloqueio): a sessão vale só enquanto a página estiver aberta.
  }
}

/** Sessão salva na aba, se ainda não expirou. */
export function restoreSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    setAuthToken(session.token);
    return session;
  } catch {
    return null;
  }
}

export function logout(): void {
  setAuthToken(null);
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada a limpar
  }
}
