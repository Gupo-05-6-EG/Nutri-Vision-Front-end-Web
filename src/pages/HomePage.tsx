/**
 * Área logada do nutricionista: abas de pacientes (vínculos, Task 1.5), do
 * construtor de planos (Task 5.1), do histórico de versões do plano (Task 5.3)
 * e dashboards de acompanhamento com alertas de abandono (Task 5.2), mais o
 * teste de conexão no rodapé.
 */

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useAuth } from '@/auth/useAuth';
import { ApiConnectionCard } from '@/components/ApiConnectionCard';
import { getHealth } from '@/lib/api';
import { env } from '@/lib/env';
import { DashboardPage } from '@/pages/DashboardPage';
import { DeviationAlertsPage } from '@/pages/DeviationAlertsPage';
import { PatientsPage } from '@/pages/PatientsPage';
import { PlanBuilderPage } from '@/pages/PlanBuilderPage';
import { PlanHistoryPage } from '@/pages/PlanHistoryPage';
import { LinkingCodePage } from '@/pages/LinkingCodePage';
import type { LinkedPatient } from '@/types/links';
import type { Plan } from '@/types/plan';

type Tab = 'patients' | 'plans' | 'history' | 'dashboard' | 'alerts';

const TABS: { id: Tab; label: string }[] = [
  { id: 'patients', label: 'Pacientes' },
  { id: 'plans', label: 'Planos alimentares' },
  { id: 'history', label: 'Histórico do plano' },
  { id: 'dashboard', label: 'Dashboards' },
  { id: 'alerts', label: 'Alertas de desvio' },
];

type Status =
  { state: 'loading' } | { state: 'ok'; service: string } | { state: 'error'; message: string };

export function HomePage() {
  const { logout } = useAuth();
  const [status, setStatus] = useState<Status>({ state: 'loading' });
  const [tab, setTab] = useState<Tab>('patients');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const tabList = useRef<HTMLElement>(null);
  // Plano ativo que abre para edição no construtor (vindo do histórico).
  const [editing, setEditing] = useState<Plan | null>(null);

  function selectTab(next: Tab) {
    setEditing(null);
    setTab(next);
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const length = TABS.length;
    const targets: Record<string, number> = {
      ArrowLeft: (index + length - 1) % length,
      ArrowRight: (index + 1) % length,
      Home: 0,
      End: length - 1,
    };
    if (!Object.hasOwn(targets, event.key)) return;
    event.preventDefault();
    const target = targets[event.key];
    selectTab(TABS[target].id);
    tabList.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus();
  }

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

  const handleSelectPatientDashboard = (patient: LinkedPatient) => {
    setSelectedPatientId(patient.id);
    setTab('dashboard');
  };

  return (
    <main className="shell">
      <header>
        <h1>{env.appName}</h1>
        <p>Painel do nutricionista — ambiente {env.environment}</p>
        <button type="button" className="button button--secondary" onClick={logout}>
          Sair
        </button>
      </header>
      <nav ref={tabList} className="tabs" role="tablist" aria-label="Seções do painel">
        {TABS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? 'tabs__tab tabs__tab--active' : 'tabs__tab'}
            onClick={() => selectTab(item.id)}
            onKeyDown={(event) => navigateTabs(event, index)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {TABS.map(({ id }) => (
        <section
          key={id}
          role="tabpanel"
          id={`panel-${id}`}
          aria-labelledby={`tab-${id}`}
          hidden={tab !== id}
          tabIndex={tab === id ? 0 : undefined}
        >
          {tab === id && (
            <>
              {tab === 'patients' && (
                <PatientsPage onSelectPatientDashboard={handleSelectPatientDashboard} />
              )}
              {tab === 'plans' && (
                <PlanBuilderPage key={editing?.id ?? 'new'} initialPlan={editing ?? undefined} />
              )}
              {tab === 'history' && (
                <PlanHistoryPage
                  onEdit={(plan) => {
                    setEditing(plan);
                    setTab('plans');
                    tabList.current?.querySelector<HTMLButtonElement>('#tab-plans')?.focus();
                  }}
                />
              )}
              {tab === 'dashboard' && (
                <DashboardPage
                  key={selectedPatientId ?? 'default'}
                  initialPatientId={selectedPatientId}
                />
              )}
              {tab === 'alerts' && <DeviationAlertsPage />}
            </>
          )}
        </section>
      ))}
      <ApiConnectionCard status={status} apiUrl={env.apiUrl} />
      <LinkingCodePage />
    </main>
  );
}
