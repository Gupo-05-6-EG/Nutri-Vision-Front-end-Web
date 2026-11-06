/** Guarda o token JWT entre recargas da página. */

const KEY = 'nutrivision.token';

export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(KEY, token);
    } catch {
      // Armazenamento bloqueado: a sessão vale só até recarregar a página.
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nada a apagar se o armazenamento está bloqueado.
    }
  },
};
