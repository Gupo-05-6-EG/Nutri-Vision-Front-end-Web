/**
 * Pacientes & Vínculos (protótipo): filtros Todos/Ativos/Em risco/Pendentes com
 * as contagens, a lista dos pacientes monitorados e a ficha do escolhido.
 */

import { useEffect, useState } from 'react';
import { Avatar, Icon } from '@/components/Icon';
import { formatNumber, getOverview } from '@/lib/portfolioApi';
import type { MonitoredPatient, Overview, SituationFilter } from '@/lib/portfolioApi';
import { PatientChart } from '@/pages/PatientChart';

const FILTERS: { id: SituationFilter; label: string; dot: string }[] = [
  { id: 'todos', label: 'Todos', dot: 'dot--muted' },
  { id: 'ativos', label: 'Ativos', dot: 'dot--ok' },
  { id: 'em_risco', label: 'Em Risco', dot: 'dot--error' },
  { id: 'pendentes', label: 'Pendentes', dot: 'dot--loading' },
];

interface Props {
  selectedId: number | null;
  initialQuery?: string;
  onSelect: (patientId: number | null) => void;
  onPrescribe: (patientId: number) => void;
  onGenerateCode: () => void;
}

export function PatientsHubPage({
  selectedId,
  initialQuery = '',
  onSelect,
  onPrescribe,
  onGenerateCode,
}: Props) {
  const [filter, setFilter] = useState<SituationFilter>('todos');
  const [search, setSearch] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    getOverview({ status: filter, busca: query, porPagina: 100 })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar os pacientes.');
      });
    return () => {
      cancelled = true;
    };
  }, [filter, query, reload]);

  const patients = data?.pacientes ?? [];
  const selected = patients.find((p) => p.paciente_id === selectedId) ?? null;

  return (
    <section aria-labelledby="hub-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            <Icon name="check" size={16} /> Prontuário de acompanhamento
          </p>
          <h1 id="hub-title" className="page-title">
            Gestão de Pacientes & Adesão Nutricional
          </h1>
        </div>
        <button type="button" className="button button--vivid" onClick={onGenerateCode}>
          <Icon name="qr" size={18} />
          Gerar Código de Vínculo
        </button>
      </div>

      <div className="filters card">
        <div className="filters__chips" role="group" aria-label="Filtrar pacientes">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              <span className={`dot ${item.dot}`} aria-hidden="true" />
              {item.label}
              <span className="filters__count">{data?.contagens[item.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label="Buscar paciente na lista"
          placeholder="Nome ou e-mail"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="hub">
        <div className="hub__list">
          <h2 className="kpi__label">Pacientes monitorados</h2>
          {data && patients.length === 0 ? (
            <p className="muted">
              {query
                ? 'Nenhum paciente encontrado para essa busca.'
                : 'Nenhum paciente neste filtro.'}
            </p>
          ) : null}
          <ul className="hub__cards">
            {patients.map((patient) => (
              <li key={patient.paciente_id}>
                <PatientCard
                  patient={patient}
                  selected={patient.paciente_id === selectedId}
                  onSelect={() => onSelect(patient.paciente_id)}
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="hub__chart">
          {selected ? (
            <PatientChart
              key={selected.paciente_id}
              patient={selected}
              onPrescribe={onPrescribe}
              onUnlinked={() => {
                onSelect(null);
                setReload((value) => value + 1);
              }}
            />
          ) : (
            <div className="card hub__empty">
              <p className="muted">Escolha um paciente para ver a ficha.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PatientCard({
  patient,
  selected,
  onSelect,
}: {
  patient: MonitoredPatient;
  selected: boolean;
  onSelect: () => void;
}) {
  const pill =
    patient.situacao === 'pendente'
      ? { className: 'pill pill--yellow', text: 'Pendente' }
      : patient.situacao === 'em_risco'
        ? { className: 'pill pill--red', text: 'Em risco' }
        : { className: 'pill pill--green', text: 'Ativo' };
  return (
    <button
      type="button"
      className={selected ? 'patient-card patient-card--selected' : 'patient-card'}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="patient-card__top">
        <Avatar name={patient.nome} size={44} />
        <span className="patient-card__who">
          <strong>{patient.nome}</strong>
          <small className="muted">{patient.email}</small>
        </span>
        <span className={pill.className}>{pill.text}</span>
      </span>
      {patient.situacao !== 'pendente' ? (
        <span className="patient-card__stats">
          <span>
            <small className="muted">Adesão</small>
            <strong>
              {patient.adesao_semanal_pct != null
                ? `${formatNumber(patient.adesao_semanal_pct)}%`
                : '—'}
            </strong>
          </span>
          <span>
            <small className="muted">Meta</small>
            <strong>
              {patient.meta_kcal != null ? `${formatNumber(patient.meta_kcal)} kcal` : '—'}
            </strong>
          </span>
          <span>
            <small className="muted">Ofensiva</small>
            <strong>
              <Icon name="flame" size={14} /> {patient.ofensiva}d
            </strong>
          </span>
        </span>
      ) : null}
    </button>
  );
}
