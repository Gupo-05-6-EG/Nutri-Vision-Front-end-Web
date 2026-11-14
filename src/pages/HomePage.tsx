/**
 * Área logada do nutricionista: abas de pacientes (vínculos, Task 1.5), do
 * construtor de planos (Task 5.1) e do histórico de versões do plano (Task
 * 5.3), mais o teste de conexão no rodapé. Os dashboards entram na Task 5.2.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { ApiConnectionCard } from '@/components/ApiConnectionCard';
import { env } from '@/lib/env';
import { DeviationAlertsPage } from '@/pages/DeviationAlertsPage';
import { PatientsPage } from '@/pages/PatientsPage';
import { PlanBuilderPage } from '@/pages/PlanBuilderPage';
import { PlanHistoryPage } from '@/pages/PlanHistoryPage';
import { getHealth } from '@/lib/api';
import type { Plan } from '@/types/plan';

type Tab = 'patients' | 'plans' | 'history' | 'alerts';

const TABS: { id: Tab; label: string }[] = [
  { id: 'patients', label: 'Pacientes' },
  { id: 'plans', label: 'Planos alimentares' },
  { id: 'history', label: 'Histórico do plano' },
  { id: 'alerts', label: 'Alertas de desvio' },
];

type Status =
  { state: 'loading' } | { state: 'ok'; service: string } | { state: 'error'; message: string };

export function HomePage() {
  const { logout } = useAuth();
  const [status, setStatus] = useState<Status>({ state: 'loading' });
  const [tab, setTab] = useState<Tab>('patients');
  // Plano ativo que abre para edição no construtor (vindo do histórico).
  const [editing, setEditing] = useState<Plan | null>(null);

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
            onClick={() => {
              setEditing(null);
              setTab(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'patients' && <PatientsPage />}
        {tab === 'plans' && (
          <PlanBuilderPage key={editing?.id ?? 'new'} initialPlan={editing ?? undefined} />
        )}
        {tab === 'history' && (
          <PlanHistoryPage
            onEdit={(plan) => {
              setEditing(plan);
              setTab('plans');
            }}
          />
        )}
        {tab === 'alerts' && <DeviationAlertsPage />}
      </section>
      <ApiConnectionCard status={status} apiUrl={env.apiUrl} />
    </main>
  );
}
