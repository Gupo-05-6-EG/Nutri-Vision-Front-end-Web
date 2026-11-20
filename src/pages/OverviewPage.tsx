/**
 * Visão Geral da Carteira (protótipo): indicadores de adesão, alertas e
 * ofensiva, e a tabela de monitoramento dos pacientes, com exportação em CSV.
 */

import { useEffect, useState } from 'react';
import { Avatar, Icon } from '@/components/Icon';
import {
  downloadText,
  formatNumber,
  getOverview,
  MEAL_LABELS,
  overviewToCsv,
  timeAgo,
} from '@/lib/portfolioApi';
import type { MonitoredPatient, Overview, SituationFilter } from '@/lib/portfolioApi';

const FILTERS: { id: SituationFilter; label: string }[] = [
  { id: 'todos', label: 'Todos os pacientes' },
  { id: 'ativos', label: 'Ativos' },
  { id: 'em_risco', label: 'Em risco' },
  { id: 'pendentes', label: 'Pendentes' },
];

const PAGE_SIZE = 8;

interface Props {
  onOpenPatient: (patientId: number) => void;
  onInvite: () => void;
}

export function OverviewPage({ onOpenPatient, onInvite }: Props) {
  const [filter, setFilter] = useState<SituationFilter>('todos');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOverview({ status: filter, pagina: page, porPagina: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar a carteira.');
      });
    return () => {
      cancelled = true;
    };
  }, [filter, page]);

  async function exportCsv() {
    setExporting(true);
    try {
      const all = await getOverview({ status: filter, porPagina: 100 });
      downloadText(overviewToCsv(all.pacientes), 'carteira-nutri-vision.csv', 'text/csv');
    } catch {
      setError('Não foi possível exportar a carteira.');
    } finally {
      setExporting(false);
    }
  }

  const indicators = data?.indicadores;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <section className="overview" aria-labelledby="overview-title">
      <div className="page-header">
        <div>
          <h1 id="overview-title" className="page-title">
            Visão Geral da Carteira
          </h1>
          <p className="page-subtitle">
            Acompanhamento da adesão, da consistência e dos alertas clínicos.
          </p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={exportCsv}
            disabled={exporting || !data}
          >
            <Icon name="download" size={18} />
            Exportar
          </button>
          <button type="button" className="button button--vivid" onClick={onInvite}>
            <Icon name="userPlus" size={18} />
            Convidar Paciente
          </button>
        </div>
      </div>

      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="kpis">
        <article className="card kpi">
          <h2 className="kpi__label">Pacientes ativos</h2>
          <strong className="kpi__value">{indicators?.pacientes_ativos ?? '—'}</strong>
          <span className="muted">
            {indicators ? `${indicators.pacientes_pendentes} aguardando aceite` : ''}
          </span>
        </article>
        <article className="card kpi kpi--warning">
          <h2 className="kpi__label">
            Alertas críticos <Icon name="alert" size={16} />
          </h2>
          <strong className="kpi__value">{indicators?.alertas_criticos ?? '—'}</strong>
          <span className="muted">requerem atenção prioritária</span>
        </article>
        <article className="card kpi">
          <h2 className="kpi__label">Taxa de adesão média</h2>
          <strong className="kpi__value">
            {indicators?.adesao_media_pct != null
              ? `${formatNumber(indicators.adesao_media_pct, 1)}%`
              : '—'}
          </strong>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${indicators?.adesao_media_pct ?? 0}%` }} />
          </div>
        </article>
        <article className="card kpi">
          <h2 className="kpi__label">
            Sequência ativa <Icon name="flame" size={16} />
          </h2>
          <strong className="kpi__value">
            {indicators?.ofensiva_media_dias != null
              ? `${formatNumber(indicators.ofensiva_media_dias, 1)} dias`
              : '—'}
          </strong>
          <span className="muted">média de ofensiva da carteira</span>
        </article>
      </div>

      <div className="card monitor">
        <div className="monitor__header">
          <div>
            <h2 className="monitor__title">Monitoramento de Pacientes</h2>
            <p className="muted">Adesão dos últimos 7 dias e o último registro de cada um.</p>
          </div>
          <label className="monitor__filter">
            <span className="visually-hidden">Filtrar pacientes</span>
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as SituationFilter);
                setPage(1);
              }}
            >
              {FILTERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({data?.contagens[item.id] ?? 0})
                </option>
              ))}
            </select>
          </label>
        </div>

        {data && data.pacientes.length === 0 ? (
          <p className="muted">Nenhum paciente neste filtro.</p>
        ) : null}

        {data && data.pacientes.length > 0 ? (
          <div className="table-scroll">
            <table className="monitor__table">
              <thead>
                <tr>
                  <th scope="col">Paciente</th>
                  <th scope="col">Meta diária</th>
                  <th scope="col">Adesão semanal</th>
                  <th scope="col">Ofensiva</th>
                  <th scope="col">Status recente</th>
                  <th scope="col">
                    <span className="visually-hidden">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.pacientes.map((patient) => (
                  <PatientRow key={patient.paciente_id} patient={patient} onOpen={onOpenPatient} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {data ? (
          <nav className="pagination" aria-label="Páginas da tabela">
            <span className="muted">
              Mostrando {data.pacientes.length} de {data.total} pacientes
            </span>
            <span className="pagination__buttons">
              <button
                type="button"
                className="button button--secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </button>
              <span aria-current="page" className="pagination__page">
                {page} / {pages}
              </span>
              <button
                type="button"
                className="button button--secondary"
                disabled={page >= pages}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </button>
            </span>
          </nav>
        ) : null}
      </div>
    </section>
  );
}

function adherenceClass(pct: number | null): string {
  if (pct === null) return 'bar';
  if (pct >= 80) return 'bar';
  if (pct >= 50) return 'bar bar--yellow';
  return 'bar bar--orange';
}

function StatusPill({ patient }: { patient: MonitoredPatient }) {
  if (patient.situacao === 'pendente') {
    return <span className="pill pill--yellow">Aguardando aceite</span>;
  }
  if (patient.motivo_risco === 'alerta_desvio') {
    return <span className="pill pill--orange">Desvio da meta</span>;
  }
  if (patient.motivo_risco === 'sem_registro') {
    return (
      <span className="pill pill--red">
        {patient.ultimo_registro
          ? `Sem registro ${timeAgo(patient.ultimo_registro.em)}`
          : 'Nenhum registro'}
      </span>
    );
  }
  const last = patient.ultimo_registro;
  return (
    <span className="pill pill--green">
      {last ? `${MEAL_LABELS[last.tipo] ?? 'Refeição'} registrado ${timeAgo(last.em)}` : 'Em dia'}
    </span>
  );
}

function PatientRow({
  patient,
  onOpen,
}: {
  patient: MonitoredPatient;
  onOpen: (patientId: number) => void;
}) {
  const pct = patient.adesao_semanal_pct;
  return (
    <tr className={patient.situacao === 'em_risco' ? 'monitor__row--risk' : undefined}>
      <td>
        <span className="person">
          <Avatar name={patient.nome} size={40} />
          <span>
            <strong>{patient.nome}</strong>
            <small className="muted">{patient.email}</small>
          </span>
        </span>
      </td>
      <td>{patient.meta_kcal != null ? `${formatNumber(patient.meta_kcal)} kcal` : '—'}</td>
      <td>
        {pct != null ? (
          <span className="adherence">
            <strong>{formatNumber(pct)}%</strong>
            <span className={adherenceClass(pct)} aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
          </span>
        ) : (
          '—'
        )}
      </td>
      <td>
        <span className={patient.ofensiva > 0 ? 'pill pill--yellow' : 'pill pill--grey'}>
          <Icon name="flame" size={14} />
          {patient.ofensiva} {patient.ofensiva === 1 ? 'dia' : 'dias'}
        </span>
      </td>
      <td>
        <StatusPill patient={patient} />
      </td>
      <td>
        <button
          type="button"
          className="button button--secondary button--small"
          aria-label={`Ver ficha de ${patient.nome}`}
          onClick={() => onOpen(patient.paciente_id)}
        >
          Ver Ficha
        </button>
      </td>
    </tr>
  );
}
