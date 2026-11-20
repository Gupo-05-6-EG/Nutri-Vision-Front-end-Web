/**
 * Navegação do painel pelo hash da URL (`#/pacientes?id=7`): o voltar do
 * navegador funciona e o link de uma seção pode ser compartilhado, sem
 * depender de biblioteca de rotas.
 */

import { useCallback, useEffect, useState } from 'react';

export type RouteName = 'visao-geral' | 'pacientes' | 'prescricao' | 'alertas';

export const ROUTES: RouteName[] = ['visao-geral', 'pacientes', 'prescricao', 'alertas'];

export interface Route {
  name: RouteName;
  params: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const name = (ROUTES as string[]).includes(path) ? (path as RouteName) : 'visao-geral';
  return { name, params: new URLSearchParams(query) };
}

export function buildHash(name: RouteName, params: Record<string, string | number> = {}): string {
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString();
  return `#/${name}${query ? `?${query}` : ''}`;
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((name: RouteName, params: Record<string, string | number> = {}) => {
    const hash = buildHash(name, params);
    if (window.location.hash === hash) {
      setRoute(parseHash(hash));
    } else {
      window.location.hash = hash;
      // jsdom e alguns navegadores só disparam `hashchange` de forma assíncrona.
      setRoute(parseHash(hash));
    }
  }, []);

  return { route, navigate };
}
