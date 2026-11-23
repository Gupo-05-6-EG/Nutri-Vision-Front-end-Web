import { useEffect, useState } from 'react';
import { PatientSelect } from '@/components/PatientSelect';
import { MealBlockEditor } from '@/components/plan/MealBlockEditor';
import {
  type DraftErrors,
  type PlanDraft,
  LIMITS,
  MEAL_NAME_SUGGESTIONS,
  createPlan,
  describeError,
  discardDraft,
  getDraft,
  saveDraft,
  draftGoals,
  emptyDraft,
  emptyMeal,
  fromPlan,
  getActivePlan,
  toPayload,
  validateDraft,
} from '@/lib/plans';
import type { Plan } from '@/types/plan';

type Notice = { kind: 'ok' | 'error' | 'info'; text: string } | null;

/** Primeiro nome sugerido que ainda não está no plano. */
function nextMealName(draft: PlanDraft): string {
  const used = new Set(draft.meals.map((meal) => meal.name));
  return MEAL_NAME_SUGGESTIONS.find((name) => !used.has(name)) ?? '';
}

const loadedText = (plan: Plan) =>
  `Plano ativo "${plan.titulo}" carregado. Ao prescrever, ele é substituído.`;

/**
 * Construtor de planos alimentares (RF09.1).
 *
 * O nutricionista monta os blocos de refeição com metas de kcal e proteínas e
 * os alimentos de cada um, e prescreve o plano para o paciente: o novo plano
 * passa a ser o ativo. Também dá para partir do plano ativo atual.
 *
 * O paciente é escolhido pelo nome. Com `initialPlan` (o plano ativo vindo do
 * histórico de versões, Task 5.3) a tela já abre com ele para edição; salvar
 * gera uma versão nova. O plano pode ser guardado como rascunho, que não vale
 * para o paciente até ser prescrito.
 */
export function PlanBuilderPage({
  initialPlan,
  initialPatientId,
}: { initialPlan?: Plan; initialPatientId?: number | null } = {}) {
  const [patientId, setPatientId] = useState(
    initialPlan
      ? String(initialPlan.paciente_id)
      : initialPatientId
        ? String(initialPatientId)
        : '',
  );
  const [draftFound, setDraftFound] = useState<Plan | null>(null);
  const [draft, setDraft] = useState<PlanDraft>(() =>
    initialPlan ? fromPlan(initialPlan) : emptyDraft(),
  );
  const [errors, setErrors] = useState<DraftErrors>({});
  const [notice, setNotice] = useState<Notice>(() =>
    initialPlan ? { kind: 'info', text: loadedText(initialPlan) } : null,
  );
  const [busy, setBusy] = useState<'loading' | 'saving' | 'drafting' | null>(null);
  const [saved, setSaved] = useState<Plan | null>(null);

  const patient = Number(patientId);
  const validPatient = Number.isInteger(patient) && patient > 0;
  const goals = draftGoals(draft);

  // Ao escolher o paciente, avisa se há um rascunho guardado para ele.
  useEffect(() => {
    if (!validPatient) return;
    let cancelled = false;
    getDraft(patient)
      .then((found) => {
        if (!cancelled) setDraftFound(found);
      })
      .catch(() => {
        // Sem rascunho legível: segue o construtor normal.
      });
    return () => {
      cancelled = true;
    };
  }, [patient, validPatient]);

  const continueDraft = () => {
    if (!draftFound) return;
    setDraft(fromPlan(draftFound));
    setErrors({});
    setSaved(null);
    setNotice({ kind: 'info', text: `Rascunho "${draftFound.titulo}" carregado.` });
    setDraftFound(null);
  };

  const storeDraft = async () => {
    if (!validPatient) {
      setNotice({ kind: 'error', text: 'Escolha o paciente.' });
      return;
    }
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setNotice({ kind: 'error', text: 'Corrija os campos destacados antes de salvar.' });
      return;
    }
    setBusy('drafting');
    setNotice(null);
    try {
      await saveDraft(patient, toPayload(draft));
      setDraftFound(null);
      setNotice({
        kind: 'ok',
        text: 'Rascunho salvo. Ele não vale para o paciente até você prescrever.',
      });
    } catch (error) {
      setNotice({ kind: 'error', text: describeError(error) });
    } finally {
      setBusy(null);
    }
  };

  const update = (next: PlanDraft) => {
    setDraft(next);
    setSaved(null);
    // Revalida só depois da primeira tentativa de envio, para não gritar enquanto digita.
    if (Object.keys(errors).length > 0) setErrors(validateDraft(next));
  };

  const loadActive = async () => {
    if (!validPatient) return;
    setBusy('loading');
    setNotice(null);
    try {
      const plan = await getActivePlan(patient);
      if (plan) {
        setDraft(fromPlan(plan));
        setErrors({});
        setSaved(null);
        setNotice({ kind: 'info', text: loadedText(plan) });
      } else {
        setNotice({ kind: 'info', text: 'Este paciente ainda não tem plano ativo.' });
      }
    } catch (error) {
      setNotice({ kind: 'error', text: describeError(error) });
    } finally {
      setBusy(null);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateDraft(draft);
    setErrors(found);
    if (!validPatient) {
      setNotice({ kind: 'error', text: 'Escolha o paciente.' });
      return;
    }
    if (Object.keys(found).length > 0) {
      setNotice({ kind: 'error', text: 'Corrija os campos destacados antes de prescrever.' });
      return;
    }
    setBusy('saving');
    setNotice(null);
    try {
      const plan = await createPlan(patient, toPayload(draft));
      // O rascunho deste paciente perde o sentido depois da prescrição.
      void discardDraft(patient).catch(() => {});
      setDraftFound(null);
      setSaved(plan);
      setNotice({
        kind: 'ok',
        text: `Plano "${plan.titulo}" prescrito: agora é o plano ativo do paciente.`,
      });
    } catch (error) {
      setNotice({ kind: 'error', text: describeError(error) });
    } finally {
      setBusy(null);
    }
  };

  const moveMeal = (index: number, offset: -1 | 1) => {
    const meals = [...draft.meals];
    [meals[index], meals[index + offset]] = [meals[index + offset], meals[index]];
    update({ ...draft, meals });
  };

  return (
    <form className="plan-builder" onSubmit={submit} noValidate>
      <section className="card">
        <h2>Paciente</h2>
        <div className="row">
          <PatientSelect
            value={patientId}
            onChange={(value) => {
              setPatientId(value);
              setSaved(null);
              setDraftFound(null);
            }}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={loadActive}
            disabled={!validPatient || busy !== null}
          >
            {busy === 'loading' ? 'Carregando…' : 'Carregar plano ativo'}
          </button>
        </div>
        {draftFound ? (
          <p className="notice notice--info draft-banner" role="status">
            Há um rascunho salvo para este paciente: &ldquo;{draftFound.titulo}&rdquo;.
            <button type="button" className="secondary-button" onClick={continueDraft}>
              Continuar rascunho
            </button>
          </p>
        ) : null}
      </section>

      <section className="card">
        <h2>Plano</h2>
        <label className="field">
          <span>Título</span>
          <input
            type="text"
            maxLength={LIMITS.title}
            placeholder="Ex.: Reeducação alimentar - fase 1"
            value={draft.title}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'titulo-erro' : undefined}
            onChange={(event) => update({ ...draft, title: event.target.value })}
          />
          {errors.title && (
            <small className="field__error" id="titulo-erro">
              {errors.title}
            </small>
          )}
        </label>
        <label className="field">
          <span>Orientações gerais</span>
          <textarea
            rows={3}
            maxLength={LIMITS.planNote}
            value={draft.note}
            onChange={(event) => update({ ...draft, note: event.target.value })}
          />
        </label>
      </section>

      {errors.meals && <p className="field__error">{errors.meals}</p>}
      {draft.meals.map((meal, index) => (
        <MealBlockEditor
          key={meal.key}
          meal={meal}
          index={index}
          total={draft.meals.length}
          errors={errors}
          onChange={(changed) =>
            update({ ...draft, meals: draft.meals.map((m) => (m.key === meal.key ? changed : m)) })
          }
          onMove={(offset) => moveMeal(index, offset)}
          onRemove={() =>
            update({ ...draft, meals: draft.meals.filter((m) => m.key !== meal.key) })
          }
        />
      ))}

      <button
        type="button"
        className="secondary-button add-meal"
        onClick={() =>
          update({ ...draft, meals: [...draft.meals, emptyMeal(nextMealName(draft))] })
        }
        disabled={draft.meals.length >= LIMITS.meals}
      >
        + Adicionar refeição
      </button>

      <footer className="plan-summary card" aria-live="polite">
        <div>
          <strong>{Math.round(goals.kcal).toLocaleString('pt-BR')} kcal</strong> ·{' '}
          <strong>{goals.protein.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} g</strong>{' '}
          de proteína
          {goals.carbs > 0 ? (
            <>
              {' '}
              ·{' '}
              <strong>
                {goals.carbs.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} g
              </strong>{' '}
              de carboidrato
            </>
          ) : null}
          {goals.fat > 0 ? (
            <>
              {' '}
              · <strong>
                {goals.fat.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} g
              </strong>{' '}
              de gordura
            </>
          ) : null}{' '}
          por dia em {draft.meals.length} {draft.meals.length === 1 ? 'refeição' : 'refeições'}
        </div>
        <div className="plan-summary__actions">
          <button
            type="button"
            className="secondary-button"
            onClick={storeDraft}
            disabled={busy !== null}
          >
            {busy === 'drafting' ? 'Salvando…' : 'Salvar rascunho'}
          </button>
          <button type="submit" className="primary-button" disabled={busy !== null}>
            {busy === 'saving' ? 'Prescrevendo…' : 'Prescrever plano'}
          </button>
        </div>
      </footer>

      {notice && (
        <p
          className={`notice notice--${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          {notice.text}
        </p>
      )}
      {saved && (
        <button type="button" className="link-button" onClick={() => update(emptyDraft())}>
          Começar um plano novo
        </button>
      )}
    </form>
  );
}
