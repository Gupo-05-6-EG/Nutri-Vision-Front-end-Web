import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from '@/auth/auth-context';
import { setAuthToken, setUnauthorizedHandler } from '@/lib/api';
import { requestLogin, requestNutritionistSignup } from '@/lib/authApi';
import { isTokenExpired } from '@/lib/jwt';
import { tokenStorage } from '@/lib/tokenStorage';
import type { AuthStatus, NutritionistSignup } from '@/types/auth';

const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente para continuar.';

interface AuthState {
  status: AuthStatus;
  notice: string | null;
}

/** Lê o token guardado e decide se o painel abre logado ou na tela de login. */
function restoreSession(): AuthState {
  const token = tokenStorage.get();
  if (!token) return { status: 'unauthenticated', notice: null };

  if (isTokenExpired(token)) {
    tokenStorage.clear();
    return { status: 'unauthenticated', notice: SESSION_EXPIRED_MESSAGE };
  }

  setAuthToken(token);
  return { status: 'authenticated', notice: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(restoreSession);

  const endSession = useCallback((notice: string | null) => {
    tokenStorage.clear();
    setAuthToken(null);
    setState({ status: 'unauthenticated', notice });
  }, []);

  // 401 com token em uso = sessão expirada ou invalidada pelo servidor.
  useEffect(() => {
    setUnauthorizedHandler(() => endSession(SESSION_EXPIRED_MESSAGE));
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  const startSession = useCallback((token: string) => {
    tokenStorage.set(token);
    setAuthToken(token);
    setState({ status: 'authenticated', notice: null });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      startSession(await requestLogin(email, password));
    },
    [startSession],
  );

  const registerNutritionist = useCallback(
    async (signup: NutritionistSignup) => {
      startSession(await requestNutritionistSignup(signup));
    },
    [startSession],
  );

  const logout = useCallback(() => endSession(null), [endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, registerNutritionist, logout }),
    [state, login, registerNutritionist, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
