/**
 * Guarda o token JWT. Com "Lembrar de mim" fica no localStorage (sobrevive a
 * fechar o navegador); sem, fica no sessionStorage (só até fechar a aba).
 */

const KEY = 'nutrivision.token';

function safe<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch {
    // Armazenamento bloqueado: a sessão vale só até recarregar a página.
    return fallback;
  }
}

export const tokenStorage = {
  get(): string | null {
    return safe(() => localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY), null);
  },
  set(token: string, remember = true): void {
    safe(() => {
      if (remember) {
        localStorage.setItem(KEY, token);
        sessionStorage.removeItem(KEY);
      } else {
        sessionStorage.setItem(KEY, token);
        localStorage.removeItem(KEY);
      }
    }, undefined);
  },
  clear(): void {
    safe(() => {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
    }, undefined);
  },
};
