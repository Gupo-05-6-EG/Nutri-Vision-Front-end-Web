/**
 * Destino temporário depois do login: a casca com o teste de conexão que já
 * existia. Os dashboards e a gestão de vínculos entram nas Tasks 1.5 e 5.x e
 * substituem esta tela.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { ApiConnectionCard } from '@/components/ApiConnectionCard';
import { env } from '@/lib/env';
import { getHealth } from '@/lib/api';

type Status =
  { state: 'loading' } | { state: 'ok'; service: string } | { state: 'error'; message: string };

export function HomePage() {
  const { logout } = useAuth();
  const [status, setStatus] = useState<Status>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((health) => {
        if (!cancelled) setStatus({ state: 'ok', service: health.service });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus({ state: 'error', message: error instanceof Error ? error.message : 'Falha' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell">
      <header>
        <h1>{env.appName}</h1>
        <p>Painel do nutricionista — ambiente {env.environment}</p>
        <button type="button" className="button button--secondary" onClick={logout}>
          Sair
        </button>
      </header>
      <ApiConnectionCard status={status} apiUrl={env.apiUrl} />
    </main>
  );
}
