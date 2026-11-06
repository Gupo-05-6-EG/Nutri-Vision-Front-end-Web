import { api } from '@/lib/api';
import type { NutritionistSignup } from '@/types/auth';

/**
 * Chamadas de autenticação (Task 1.2 [Back]). Login e cadastro devolvem o
 * mesmo `TokenOut`, então o painel já sai do cadastro logado.
 */
const LOGIN_PATH = '/auth/login';
const REGISTER_PATH = '/auth/cadastro/nutricionista';

interface TokenResponse {
  access_token?: string;
}

function readToken(data: TokenResponse | undefined): string {
  if (!data?.access_token) throw new Error('Resposta sem token.');
  return data.access_token;
}

/** Faz login e devolve o token JWT. */
export async function requestLogin(email: string, password: string): Promise<string> {
  const data = await api.post<TokenResponse | undefined>(LOGIN_PATH, { email, senha: password });
  return readToken(data);
}

/** Cadastra o nutricionista e devolve o token JWT. */
export async function requestNutritionistSignup(signup: NutritionistSignup): Promise<string> {
  const data = await api.post<TokenResponse | undefined>(REGISTER_PATH, {
    nome: signup.name,
    email: signup.email,
    senha: signup.password,
    crn: signup.crn,
  });
  return readToken(data);
}
