import { api } from '@/lib/api';

/** Usuário logado (`GET /auth/me`): nome e CRN no topo do painel. */
export interface Me {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  crn: string | null;
}

export function getMe(): Promise<Me> {
  return api.get<Me>('/auth/me');
}
