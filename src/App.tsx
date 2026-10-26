/**
 * Casca do painel do nutricionista.
 *
 * Sem sessão, mostra o login; com sessão, o construtor de planos (Task 5.1).
 * O cartão de conexão com a API continua no rodapé para diagnóstico. As outras
 * telas entram nas Tasks 1.5 (vínculos) e 5.2 (dashboards).
 */

import { useEffect, useState } from 'react';
import { ApiConnectionCard } from '@/components/ApiConnectionCard';
import { type Session, logout, restoreSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getHealth } from '@/lib/api';
import { LoginPage } from '@/pages/LoginPage';
import { PlanBuilderPage } from '@/pages/PlanBuilderPage';

type Status =
  { state: 'loading' } | { state: 'ok'; service: string } | { state: 'error'; message: string };

export default function App() {
  const [status, setStatus] = useState<Status>({ state: 'loading' });
  const [session, setSession] = useState<Session | null>(restoreSession);

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
      <header className="shell__header">
        <div>
          <h1>{env.appName}</h1>
          <p>
            {session ? 'Construtor de planos alimentares' : 'Painel do nutricionista'} — ambiente{' '}
            {env.environment}
          </p>
        </div>
        {session && (
          <div className="session">
            <span>{session.user.nome}</span>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                logout();
                setSession(null);
              }}
            >
              Sair
            </button>
          </div>
        )}
      </header>
      {session ? <PlanBuilderPage /> : <LoginPage onLogin={setSession} />}
      <ApiConnectionCard status={status} apiUrl={env.apiUrl} />
    </main>
  );
}
