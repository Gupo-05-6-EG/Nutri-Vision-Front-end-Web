import { useState } from 'react';
import { describeError } from '@/lib/plans';
import { diffPlans, formatDateTime, listPlanVersions } from '@/lib/planHistory';
import type { PlanVersion } from '@/types/plan';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; versions: PlanVersion[] };

const SIGN = { added: '+', removed: '−', changed: '~' } as const;

const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

interface Props {
  /** Abre o construtor de planos já com o plano ativo para edição. */
  onEdit: (plan: PlanVersion) => void;
}

/**
 * Histórico de versões do plano alimentar (Task 5.3, RF08 e RNF08).
 *
 * Lista, da mais nova para a mais antiga, cada versão salva com o autor, a
 * data/hora e o que mudou em relação à anterior. Dali o nutricionista pode
 * abrir o plano ativo para editar: salvar gera uma versão nova.
 *
 * O paciente é escolhido pelo id, como no construtor de planos.
 */
export function PlanHistoryPage({ onEdit }: Props) {
  const [patientId, setPatientId] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  const patient = Number(patientId);
  const validPatient = Number.isInteger(patient) && patient > 0;
  const active = state.status === 'ready' ? state.versions.find((v) => v.ativo) : undefined;

  const load = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validPatient) return;
    setState({ status: 'loading' });
    try {
      const versions = await listPlanVersions(patient);
      setState({ status: 'ready', versions });
    } catch (error) {
      setState({ status: 'error', message: describeError(error) });
    }
  };

  return (
    <div className="plan-history">
      <form className="card" onSubmit={load} noValidate>
        <h2>Histórico do plano</h2>
        <div className="row">
          <label className="field">
            <span>Id do paciente</span>
            <input
              type="text"
              inputMode="numeric"
              value={patientId}
              onChange={(event) => setPatientId(event.target.value.replace(/\D/g, ''))}
            />
          </label>
          <button
            type="submit"
            className="secondary-button"
            disabled={!validPatient || state.status === 'loading'}
          >
            {state.status === 'loading' ? 'Carregando…' : 'Ver histórico'}
          </button>
        </div>
      </form>

      {state.status === 'error' && (
        <p className="notice notice--error" role="alert">
          {state.message}
        </p>
      )}

      {state.status === 'ready' && state.versions.length === 0 && (
        <p className="notice notice--info" role="status">
          Este paciente ainda não tem plano.
        </p>
      )}

      {state.status === 'ready' && state.versions.length > 0 && (
        <>
          <div className="plan-history__toolbar">
            <span>
              {state.versions.length} {state.versions.length === 1 ? 'versão' : 'versões'}
            </span>
            {active && (
              <button type="button" className="primary-button" onClick={() => onEdit(active)}>
                Editar plano ativo
              </button>
            )}
          </div>
          <ol className="history" aria-label="Versões do plano">
            {state.versions.map((version, index) => (
              <VersionItem
                key={version.id}
                version={version}
                previous={state.versions[index + 1] ?? null}
              />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function VersionItem({
  version,
  previous,
}: {
  version: PlanVersion;
  previous: PlanVersion | null;
}) {
  const changes = diffPlans(previous, version);

  return (
    <li className="card history__item">
      <header className="history__header">
        <h3>Versão {version.versao}</h3>
        {version.ativo && <span className="history__badge">Ativa</span>}
      </header>
      <p className="history__meta">
        {version.autor?.nome ?? 'Autor removido'} · {formatDateTime(version.criado_em)}
      </p>
      <p className="history__title">{version.titulo}</p>

      <h4>O que mudou</h4>
      {changes.length === 0 ? (
        <p className="history__none">Sem alterações nos dados do plano.</p>
      ) : (
        <ul className="changes">
          {changes.map((change, i) => (
            <li key={i} className={`change change--${change.kind}`}>
              <span aria-hidden="true">{SIGN[change.kind]}</span> {change.text}
            </li>
          ))}
        </ul>
      )}

      <details className="history__details">
        <summary>Ver plano completo</summary>
        {version.observacao && <p>{version.observacao}</p>}
        {version.refeicoes.map((meal) => (
          <div key={meal.id} className="history__meal">
            <strong>{meal.nome}</strong>
            {meal.horario && ` · ${meal.horario.slice(0, 5)}`} · {number(meal.meta_kcal)} kcal ·{' '}
            {number(meal.meta_proteinas_g)} g de proteína
            <ul>
              {meal.alimentos.map((food) => (
                <li key={food.id}>
                  {food.nome_alimento} — {number(food.quantidade_g)} g
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </li>
  );
}
