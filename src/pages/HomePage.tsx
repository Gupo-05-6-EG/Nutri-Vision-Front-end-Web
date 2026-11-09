/**
 * Área logada do nutricionista: abas de pacientes (vínculos, Task 1.5) e do
 * construtor de planos (Task 5.1), mais o teste de conexão no rodapé. Os
 * dashboards entram na Task 5.2.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { ApiConnectionCard } from '@/components/ApiConnectionCard';
import { env } from '@/lib/env';
import { PatientsPage } from '@/pages/PatientsPage';
import { PlanBuilderPage } from '@/pages/PlanBuilderPage';
import { getHealth } from '@/lib/api';

type Tab = 'patients' | 'plans';

const TABS: { id: Tab; label: string }[] = [
  { id: 'patients', label: 'Pacientes' },
  { id: 'plans', label: 'Planos alimentares' },
];

type Status =
  { state: 'loading' } | { state: 'ok'; service: string } | { state: 'error'; message: string };

export function HomePage() {
  const { logout } = useAuth();
  const [status, setStatus] = useState<Status>({ state: 'loading' });
  const [tab, setTab] = useState<Tab>('patients');

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
      <nav className="tabs" role="tablist" aria-label="Seções do painel">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            className={tab === item.id ? 'tabs__tab tabs__tab--active' : 'tabs__tab'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'patients' ? <PatientsPage /> : <PlanBuilderPage />}
      </section>
      <ApiConnectionCard status={status} apiUrl={env.apiUrl} />
    </main>
  );
}
