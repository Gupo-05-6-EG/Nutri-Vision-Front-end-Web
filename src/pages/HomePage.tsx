/**
 * Área logada do nutricionista: abas de pacientes (vínculos, Task 1.5),
 * construtor de planos (Task 5.1) e dashboards de acompanhamento com alertas
 * de abandono (Task 5.2), mais o teste de conexão no rodapé.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { ApiConnectionCard } from '@/components/ApiConnectionCard';
import { getHealth } from '@/lib/api';
import { env } from '@/lib/env';
import { DashboardPage } from '@/pages/DashboardPage';
import { PatientsPage } from '@/pages/PatientsPage';
import { PlanBuilderPage } from '@/pages/PlanBuilderPage';
import type { LinkedPatient } from '@/types/links';

type Tab = 'patients' | 'plans' | 'dashboard';

const TABS: { id: Tab; label: string }[] = [
  { id: 'patients', label: 'Pacientes' },
  { id: 'plans', label: 'Planos alimentares' },
  { id: 'dashboard', label: 'Dashboards' },
];

type Status =
  { state: 'loading' } | { state: 'ok'; service: string } | { state: 'error'; message: string };

export function HomePage() {
  const { logout } = useAuth();
  const [status, setStatus] = useState<Status>({ state: 'loading' });
  const [tab, setTab] = useState<Tab>('patients');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

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
        {tab === 'patients' && (
          <PatientsPage onSelectPatientDashboard={handleSelectPatientDashboard} />
        )}
        {tab === 'plans' && <PlanBuilderPage />}
        {tab === 'dashboard' && (
          <DashboardPage
            key={selectedPatientId ?? 'default'}
            initialPatientId={selectedPatientId}
          />
        )}
      </section>
      <ApiConnectionCard status={status} apiUrl={env.apiUrl} />
    </main>
  );
}
