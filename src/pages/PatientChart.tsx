/**
 * Ficha do paciente (protótipo "Gestão de Pacientes & Adesão"): dados da
 * triagem (peso, altura, IMC, TMB, nível de atividade, meta), planejado ×
 * consumido de hoje, gráfico de 7 dias, relatório PDF, incentivo de XP,
 * ajuste da prescrição e desvínculo.
 */

import { useEffect, useState } from 'react';
import { Avatar, Icon } from '@/components/Icon';
import { ApiError, api } from '@/lib/api';
import { describeLinkError } from '@/lib/linkErrors';
import { unlinkPatient } from '@/lib/linksApi';
import {
  ACTIVITY_LABELS,
  formatNumber,
  getPatientProfile,
  giveIncentive,
} from '@/lib/portfolioApi';
import type { MonitoredPatient, PatientProfile } from '@/lib/portfolioApi';
import { DashboardPage } from '@/pages/DashboardPage';
import { EvolutionReport } from '@/pages/EvolutionReport';

interface Totals {
  calorias_kcal?: number;
  proteinas_g?: number;
  carboidratos_g?: number;
  gorduras_g?: number;
}

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

interface Props {
  patient: MonitoredPatient;
  onPrescribe: (patientId: number) => void;
  onUnlinked: () => void;
}

export function PatientChart({ patient, onPrescribe, onUnlinked }: Props) {
  const pending = patient.situacao === 'pendente';
  const id = patient.paciente_id;
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  useEffect(() => {
    if (pending) return;
    let cancelled = false;
    Promise.all([
      getPatientProfile(id),
      api.get<{ totais?: Totals }>(`/refeicoes/consumo-diario?paciente_id=${id}&data=${today()}`),
    ])
      .then(([loadedProfile, consumption]) => {
        if (cancelled) return;
        setProfile(loadedProfile);
        setTotals(consumption?.totais ?? {});
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar a ficha do paciente.');
      });
    return () => {
      cancelled = true;
    };
  }, [id, pending]);

  async function incentive() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await giveIncentive(id);
      setMessage({
        kind: 'ok',
        text: `+${result.xp_concedido} XP enviados para ${patient.nome}.`,
      });
    } catch (failure) {
      setMessage({
        kind: 'error',
        text:
          failure instanceof ApiError && failure.status === 409
            ? `${patient.nome} já recebeu o incentivo hoje.`
            : 'Não foi possível enviar o incentivo.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      await unlinkPatient(id);
      onUnlinked();
    } catch (failure) {
      setMessage({ kind: 'error', text: describeLinkError(failure) });
      setBusy(false);
    }
  }

  const since = new Date(patient.vinculado_em);
  return (
    <article className="card chart" aria-labelledby="chart-title">
      <header className="chart__header">
        <Avatar name={patient.nome} size={72} />
        <div>
          <h2 id="chart-title" className="chart__name">
            {patient.nome}
            <span className={pending ? 'pill pill--yellow' : 'pill pill--green'}>
              {pending ? 'Vínculo pendente' : 'Vínculo ativo'}
            </span>
          </h2>
          <p className="muted">
            Acompanhamento desde {since.getDate()} de {MONTHS[since.getMonth()]} de{' '}
            {since.getFullYear()}
            {profile?.plano_ativo
              ? ` · Plano: ${profile.plano_ativo.titulo} (v${profile.plano_ativo.versao})`
              : ''}
          </p>
        </div>
      </header>

      {pending ? (
        <p className="notice">
          {patient.nome} resgatou o seu código e ainda precisa aceitar o vínculo no app. Os dados de
          saúde aparecem aqui depois do aceite.
        </p>
      ) : (
        <>
          <div className="chart__actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => onPrescribe(id)}
            >
              <Icon name="edit" size={18} />
              Ajustar Prescrição
            </button>
            <button
              type="button"
              className="button button--yellow"
              onClick={incentive}
              disabled={busy}
            >
              <Icon name="star" size={18} />
              Incentivo (+10 XP)
            </button>
          </div>
          {message ? (
            <p
              className={message.kind === 'ok' ? 'notice notice--ok' : 'notice notice--error'}
              role="status"
            >
              {message.text}
            </p>
          ) : null}
          {error ? (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          ) : null}

          {profile ? <Stats profile={profile} /> : null}
          {profile && totals ? <PlannedVsConsumed profile={profile} totals={totals} /> : null}
          <DashboardPage initialPatientId={id} hidePatientSelect />
          <div className="chart__report">
            <h3>Relatório de evolução (PDF)</h3>
            <EvolutionReport patientId={id} />
          </div>
        </>
      )}

      <div className="chart__danger">
        {confirmUnlink ? (
          <>
            <span>Desvincular {patient.nome}?</span>
            <button
              type="button"
              className="button button--danger"
              onClick={unlink}
              disabled={busy}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setConfirmUnlink(false)}
              disabled={busy}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" className="link" onClick={() => setConfirmUnlink(true)}>
            Desvincular paciente
          </button>
        )}
      </div>
    </article>
  );
}

function Stats({ profile }: { profile: PatientProfile }) {
  const items = [
    {
      label: 'Peso atual',
      value: profile.peso_kg != null ? `${formatNumber(profile.peso_kg, 1)} kg` : '—',
    },
    {
      label: 'Altura',
      value: profile.altura_cm != null ? `${formatNumber(profile.altura_cm / 100, 2)} m` : '—',
    },
    {
      label: 'IMC',
      value: profile.imc != null ? formatNumber(profile.imc, 1) : '—',
      hint: profile.classificacao_imc ?? undefined,
    },
    {
      label: 'TMB est.',
      value: profile.tmb_kcal != null ? `${formatNumber(profile.tmb_kcal)} kcal` : '—',
      hint: profile.tmb_kcal != null ? 'Harris-Benedict' : undefined,
    },
    {
      label: 'Nível físico',
      value: profile.nivel_atividade ? (ACTIVITY_LABELS[profile.nivel_atividade] ?? '—') : '—',
    },
    {
      label: 'Meta diária',
      value: profile.meta.kcal != null ? `${formatNumber(profile.meta.kcal)} kcal` : '—',
      hint:
        profile.meta.origem === 'plano'
          ? 'Do plano'
          : profile.meta.origem === 'triagem'
            ? 'Da triagem'
            : undefined,
    },
  ];
  return (
    <dl className="stats">
      {items.map((item) => (
        <div key={item.label} className="stats__item">
          <dt>{item.label}</dt>
          <dd>
            <strong>{item.value}</strong>
            {item.hint ? <small className="muted">{item.hint}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PlannedVsConsumed({ profile, totals }: { profile: PatientProfile; totals: Totals }) {
  const rows = [
    {
      label: 'Calorias totais',
      unit: 'kcal',
      planned: profile.meta.kcal,
      consumed: totals.calorias_kcal ?? 0,
      bar: 'bar',
    },
    {
      label: 'Proteínas',
      unit: 'g',
      planned: profile.meta.proteinas_g,
      consumed: totals.proteinas_g ?? 0,
      bar: 'bar bar--yellow',
    },
    {
      label: 'Carboidratos',
      unit: 'g',
      planned: profile.meta.carboidratos_g,
      consumed: totals.carboidratos_g ?? 0,
      bar: 'bar',
    },
    {
      label: 'Gorduras',
      unit: 'g',
      planned: profile.meta.gorduras_g,
      consumed: totals.gorduras_g ?? 0,
      bar: 'bar bar--orange',
    },
  ];
  return (
    <section aria-labelledby="pvc-title">
      <h3 id="pvc-title" className="chart__section">
        Planejado vs. Consumido Hoje
      </h3>
      <div className="pvc">
        {rows.map((row) => {
          const pct = row.planned ? Math.round((100 * row.consumed) / row.planned) : null;
          const rest = row.planned != null ? row.planned - row.consumed : null;
          return (
            <div key={row.label} className="card pvc__item">
              <div className="pvc__top">
                <span className="kpi__label">{row.label}</span>
                {pct != null ? <span className="pill pill--green">{pct}%</span> : null}
              </div>
              <strong className="pvc__value">
                {formatNumber(row.consumed)}
                <small>
                  {' '}
                  / {row.planned != null ? formatNumber(row.planned) : '—'} {row.unit}
                </small>
              </strong>
              <div className={row.bar} aria-hidden="true">
                <span style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
              </div>
              <small className="muted">
                {rest == null
                  ? 'Sem meta definida'
                  : rest >= 0
                    ? `Faltam ${formatNumber(rest)} ${row.unit}`
                    : `${formatNumber(-rest)} ${row.unit} acima da meta`}
              </small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
