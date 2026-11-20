/**
 * Dashboard clínico de desempenho e alertas de abandono (Task 5.2, RF07.1,
 * RF10.1): seleciona o paciente vinculado, exibe alerta vermelho caso o
 * paciente esteja em abandono (`streak == 0` por 3 dias consecutivos) e plota
 * o gráfico Recharts de 7 dias comparando Meta Calórica vs Consumo Real.
 */

import { useEffect, useState } from 'react';
import { FormAlert } from '@/components/FormAlert';
import { SevenDayCaloriesChart } from '@/components/dashboard/SevenDayCaloriesChart';
import { fetchPatientDashboard, hasConsecutiveInactivity } from '@/lib/dashboard';
import { describeLinkError } from '@/lib/linkErrors';
import { hasAbandonmentAlert, listPatients } from '@/lib/linksApi';
import { describeError } from '@/lib/plans';
import type { PatientDashboardData } from '@/types/dashboard';
import type { LinkedPatient } from '@/types/links';

export interface DashboardPageProps {
  initialPatientId?: number | null;
  referenceDate?: Date;
  /** Dentro da ficha do paciente: o paciente já está escolhido. */
  hidePatientSelect?: boolean;
}

type PatientsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: LinkedPatient[] };

type DashboardState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: PatientDashboardData };

export function DashboardPage({
  initialPatientId = null,
  referenceDate,
  hidePatientSelect = false,
}: DashboardPageProps = {}) {
  const [patientsState, setPatientsState] = useState<PatientsState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<number | null>(initialPatientId);
  const [dashboardState, setDashboardState] = useState<DashboardState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    listPatients()
      .then((list) => {
        if (cancelled) return;
        setPatientsState({ status: 'ready', list });
        if (list.length > 0) {
          setSelectedId((current) =>
            current !== null && list.some((p) => p.id === current) ? current : list[0].id,
          );
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setPatientsState({ status: 'error', message: describeLinkError(failure) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    let cancelled = false;
    fetchPatientDashboard(selectedId, referenceDate)
      .then((data) => {
        if (!cancelled) setDashboardState({ status: 'ready', data });
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setDashboardState({ status: 'error', message: describeError(failure) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, referenceDate]);

  const patients = patientsState.status === 'ready' ? patientsState.list : [];
  const selectedPatient = patients.find((patient) => patient.id === selectedId) ?? null;
  const dashboard =
    dashboardState.status === 'ready' && dashboardState.data.patientId === selectedId
      ? dashboardState.data
      : null;
  const loadingDashboard =
    selectedId !== null && dashboard === null && dashboardState.status !== 'error';

  const abandonedByStreak = selectedPatient ? hasAbandonmentAlert(selectedPatient) : false;
  const abandonedByInactivity = dashboard ? hasConsecutiveInactivity(dashboard.days, 3) : false;
  const showAbandonmentBanner = abandonedByStreak || abandonedByInactivity;

  return (
    <div className="dashboard" aria-labelledby="dashboard-title">
      <section className="card">
        <h2 id="dashboard-title">Desempenho e adesão (7 dias)</h2>

        {patientsState.status === 'error' && <FormAlert message={patientsState.message} />}

        {patientsState.status === 'loading' && (
          <p className="patients__empty">Carregando pacientes…</p>
        )}

        {patientsState.status === 'ready' && patients.length === 0 && (
          <p className="patients__empty">Nenhum paciente vinculado para visualizar o dashboard.</p>
        )}

        {patients.length > 0 && !hidePatientSelect && (
          <div className="field">
            <label htmlFor="dashboard-patient-select">Paciente</label>
            <select
              id="dashboard-patient-select"
              value={selectedId ?? ''}
              onChange={(event) => {
                setDashboardState({ status: 'loading' });
                setSelectedId(Number(event.target.value));
              }}
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} ({patient.email})
                  {hasAbandonmentAlert(patient) ? ' — ⚠ Alerta de abandono' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {showAbandonmentBanner && selectedPatient && (
        <div className="alert alert--error dashboard__abandonment" role="alert">
          <svg
            className="abandonment-badge__icon"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
            focusable="false"
          >
            <path fill="currentColor" d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z" />
          </svg>
          <div>
            <strong>Alerta de abandono do plano:</strong> {selectedPatient.name} está com ofensiva
            zerada (<code>streak == 0</code>) por 3 ou mais dias consecutivos.
          </div>
        </div>
      )}

      {dashboardState.status === 'error' && <FormAlert message={dashboardState.message} />}

      {loadingDashboard && (
        <section className="card">
          <p className="patients__empty">Carregando dados de desempenho…</p>
        </section>
      )}

      {dashboard && (
        <>
          <section className="card dashboard__metrics" aria-label="Resumo dos últimos 7 dias">
            <div className="dashboard__metric">
              <span>Plano ativo</span>
              <strong>{dashboard.planTitle ?? 'Sem plano prescrito'}</strong>
            </div>
            <div className="dashboard__metric">
              <span>Meta calórica diária</span>
              <strong>
                {dashboard.goalKcal > 0
                  ? `${dashboard.goalKcal.toLocaleString('pt-BR')} kcal`
                  : 'Não definida'}
              </strong>
            </div>
            <div className="dashboard__metric">
              <span>Média consumida (7d)</span>
              <strong>{dashboard.averageConsumedKcal.toLocaleString('pt-BR')} kcal</strong>
            </div>
            <div className="dashboard__metric">
              <span>Dias dentro da meta</span>
              <strong>{dashboard.adherenceDays} de 7 dias</strong>
            </div>
          </section>

          <section className="card">
            <h2>Meta Calórica vs Consumo Real (últimos 7 dias)</h2>
            <SevenDayCaloriesChart days={dashboard.days} />

            <table className="dashboard__table" aria-label="Tabela de consumo dos últimos 7 dias">
              <thead>
                <tr>
                  <th scope="col">Dia</th>
                  <th scope="col">Meta (kcal)</th>
                  <th scope="col">Consumo (kcal)</th>
                  <th scope="col">Refeições</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.days.map((day) => (
                  <tr key={day.date}>
                    <td>{day.label}</td>
                    <td>{day.goalKcal.toLocaleString('pt-BR')}</td>
                    <td>{day.consumedKcal.toLocaleString('pt-BR')}</td>
                    <td>{day.mealCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
