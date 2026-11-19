import { createContext } from 'react';
import type { AuthStatus, NutritionistSignup } from '@/types/auth';

export interface AuthContextValue {
  status: AuthStatus;
  /** Aviso para a tela de login (ex.: sessão expirada). */
  notice: string | null;
  /** `remember` (padrão true): guarda a sessão depois de fechar o navegador. */
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  /** Cadastra e já entra: a API de cadastro devolve o token. */
  registerNutritionist: (signup: NutritionistSignup) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
