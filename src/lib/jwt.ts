/**
 * Leitura do JWT guardado no navegador.
 *
 * Não valida assinatura (papel do back-end): serve só para saber se o token já
 * expirou antes de tentar usá-lo.
 */

/** Instante de expiração (claim `exp`) em ms, ou `null` se não der para ler. */
export function getTokenExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof payload !== 'object' || payload === null) return null;

    const exp = (payload as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** `true` quando o token tem `exp` e ele já passou. Sem `exp`, vale até a API dar 401. */
export function isTokenExpired(token: string, now: number = Date.now()): boolean {
  const expiry = getTokenExpiry(token);
  return expiry !== null && now >= expiry;
}
