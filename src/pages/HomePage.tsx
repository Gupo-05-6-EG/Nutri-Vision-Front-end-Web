/**
 * Área logada do nutricionista no layout do protótipo: menu lateral (Visão
 * Geral, Pacientes & Vínculos, Prescrição de Dietas e Alertas), barra superior
 * com a busca de paciente e o profissional logado, e a seção escolhida.
 *
 * A seção fica no hash da URL (`#/pacientes`), então o voltar do navegador e o
 * recarregar a página mantêm onde o nutricionista estava.
 */

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/auth/useAuth';
import { Avatar, Icon } from '@/components/Icon';
import { NotificationBell } from '@/components/NotificationBell';
import type { IconName } from '@/components/Icon';
import { getMe } from '@/lib/meApi';
import type { Me } from '@/lib/meApi';
import { useHashRoute } from '@/lib/useHashRoute';
import type { RouteName } from '@/lib/useHashRoute';
import { DeviationAlertsPage } from '@/pages/DeviationAlertsPage';
import { LinkingCodeDialog } from '@/pages/LinkingCodeDialog';
import { OverviewPage } from '@/pages/OverviewPage';
import { PatientsHubPage } from '@/pages/PatientsHubPage';
import { PlanBuilderPage } from '@/pages/PlanBuilderPage';
import { PlanHistoryPage } from '@/pages/PlanHistoryPage';
import type { Plan } from '@/types/plan';

export const NAV: { id: RouteName; label: string; icon: IconName }[] = [
  { id: 'visao-geral', label: 'Visão Geral', icon: 'grid' },
  { id: 'pacientes', label: 'Pacientes & Vínculos', icon: 'users' },
  { id: 'prescricao', label: 'Prescrição de Dietas', icon: 'apple' },
  { id: 'alertas', label: 'Alertas de Desvio', icon: 'alert' },
];

export function HomePage() {
  const { logout } = useAuth();
  const { route, navigate } = useHashRoute();
  const [me, setMe] = useState<Me | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Plano ativo que abre para edição no construtor (vindo do histórico).
  const [editing, setEditing] = useState<Plan | null>(null);
  const [prescriptionView, setPrescriptionView] = useState<'builder' | 'history'>('builder');

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        // O topo só fica sem o nome: o resto do painel funciona.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function go(name: RouteName, params: Record<string, string | number> = {}) {
    setMenuOpen(false);
    if (name !== 'prescricao') setEditing(null);
    navigate(name, params);
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    go('pacientes', search.trim() ? { busca: search.trim() } : {});
  }

  const patientId = Number(route.params.get('id')) || null;
  const current = NAV.find((item) => item.id === route.name) ?? NAV[0];

  return (
    <div className="app-shell">
      <aside className={menuOpen ? 'sidebar sidebar--open' : 'sidebar'}>
        <div className="brand">
          <span className="brand__logo">
            <Icon name="leaf" size={22} />
          </span>
          <span>
            <strong>Nutri Vision</strong>
            <small>Painel Clínico</small>
          </span>
        </div>
        <nav aria-label="Menu do painel">
          <ul className="sidebar__nav">
            {NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={`#/${item.id}`}
                  className={
                    item.id === route.name ? 'sidebar__link sidebar__link--active' : 'sidebar__link'
                  }
                  aria-current={item.id === route.name ? 'page' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    go(item.id);
                  }}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="app-shell__main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__menu"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <form className="topbar__search" role="search" onSubmit={onSearch}>
            <Icon name="search" />
            <input
              type="search"
              aria-label="Buscar paciente"
              placeholder="Buscar paciente por nome ou e-mail..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </form>
          <NotificationBell onOpenPatient={(id) => go('pacientes', { id })} />
          <div className="topbar__user">
            {me ? (
              <span className="topbar__who">
                <strong>{me.nome}</strong>
                {me.crn ? <small>{me.crn}</small> : null}
              </span>
            ) : null}
            <Avatar name={me?.nome ?? ''} size={38} />
            <button type="button" className="button button--secondary" onClick={logout}>
              <Icon name="logout" size={18} />
              Sair
            </button>
          </div>
        </header>

        <main className="content" aria-label={current.label}>
          {route.name === 'visao-geral' && (
            <OverviewPage
              onOpenPatient={(id) => go('pacientes', { id })}
              onInvite={() => setCodeOpen(true)}
            />
          )}
          {route.name === 'pacientes' && (
            <>
              <PatientsHubPage
                key={route.params.get('busca') ?? ''}
                selectedId={patientId}
                initialQuery={route.params.get('busca') ?? ''}
                onSelect={(id) => go('pacientes', id ? { id } : {})}
                onPrescribe={(id) => go('prescricao', { id })}
                onGenerateCode={() => setCodeOpen(true)}
              />
            </>
          )}
          {route.name === 'prescricao' && (
            <section aria-label="Prescrição de dietas">
              <div className="segmented" role="group" aria-label="Prescrição">
                <button
                  type="button"
                  aria-pressed={prescriptionView === 'builder'}
                  onClick={() => setPrescriptionView('builder')}
                >
                  Construtor do plano
                </button>
                <button
                  type="button"
                  aria-pressed={prescriptionView === 'history'}
                  onClick={() => {
                    setEditing(null);
                    setPrescriptionView('history');
                  }}
                >
                  Histórico do plano
                </button>
              </div>
              {prescriptionView === 'builder' ? (
                <PlanBuilderPage
                  key={editing?.id ?? `novo-${patientId ?? ''}`}
                  initialPlan={editing ?? undefined}
                  initialPatientId={patientId}
                />
              ) : (
                <PlanHistoryPage
                  onEdit={(plan) => {
                    setEditing(plan);
                    setPrescriptionView('builder');
                  }}
                />
              )}
            </section>
          )}
          {route.name === 'alertas' && <DeviationAlertsPage />}
        </main>
      </div>
      <LinkingCodeDialog open={codeOpen} onClose={() => setCodeOpen(false)} />
    </div>
  );
}
