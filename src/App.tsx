/**
 * Casca do painel do nutricionista.
 *
 * Nesta task ela só existe para provar que o build, o alias `@/` e a leitura
 * do `.env` estão de pé: mostra a conexão com a API. As telas reais entram nas
 * Tasks 1.2 (login), 1.5 (vínculos) e 5.x (planos e dashboards).
 */

import { useEffect, useState } from 'react';
import { ApiConnectionCard } from '@/components/ApiConnectionCard';
import { env } from '@/lib/env';
import { getHealth } from '@/lib/api';

type Status =
  { state: 'loading' } | { state: 'ok'; service: string } | { state: 'error'; message: string };

export default function App() {
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
      </header>
      <ApiConnectionCard status={status} apiUrl={env.apiUrl} />
    </main>
  );
}
