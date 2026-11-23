/**
 * Histórico de versões do plano alimentar (Task 5.3, RF08 e RNF08).
 *
 * Cada vez que o nutricionista salva o plano (`POST /pacientes/{id}/planos`) o
 * back-end guarda uma versão nova e desativa a anterior. Este módulo lê o
 * histórico e calcula "o que mudou" entre duas versões consecutivas.
 *
 * Contrato esperado do back-end (Task 5.3 [Back]), só para nutricionista
 * vinculado ao paciente:
 *
 *   GET /pacientes/{paciente_id}/planos/versoes
 *   -> 200 PlanVersion[], da mais nova para a mais antiga.
 *      Cada item é o `Plan` completo daquela versão, mais:
 *        - `versao`: número sequencial por paciente (1 = primeiro plano);
 *        - `autor`: `{ id, nome }` do nutricionista que salvou, ou `null`
 *          se a conta dele foi removida.
 *      `criado_em` é a data/hora em que a versão foi salva.
 *   -> 404 "Paciente nao encontrado"; 403 "Sem vinculo com este paciente".
 *
 * O "o que mudou" é calculado aqui, comparando cada versão com a anterior.
 */

import { api } from '@/lib/api';
import type { Plan, PlanMeal, PlanVersion } from '@/types/plan';

export const listPlanVersions = (patientId: number) =>
  api.get<PlanVersion[]>(`/pacientes/${patientId}/planos/versoes`);

export type ChangeKind = 'added' | 'removed' | 'changed';

export interface PlanChange {
  kind: ChangeKind;
  text: string;
}

const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const quote = (text: string) => `“${text}”`;
const norm = (text: string) => text.trim().toLowerCase();
const hour = (time: string | null) => time?.slice(0, 5) ?? null;

/** Chave do alimento no bloco: o nome e quantas vezes ele já apareceu antes. */
function foodKeys(meal: PlanMeal): Map<string, PlanMeal['alimentos'][number]> {
  const seen = new Map<string, number>();
  const keys = new Map<string, PlanMeal['alimentos'][number]>();
  for (const food of meal.alimentos) {
    const name = norm(food.nome_alimento);
    const occurrence = seen.get(name) ?? 0;
    seen.set(name, occurrence + 1);
    keys.set(`${name}#${occurrence}`, food);
  }
  return keys;
}

function diffMeal(before: PlanMeal, after: PlanMeal): PlanChange[] {
  const changes: PlanChange[] = [];
  const prefix = `${after.nome}: `;
  const changed = (text: string) => changes.push({ kind: 'changed', text: prefix + text });

  if (hour(before.horario) !== hour(after.horario)) {
    changed(
      `horário ${hour(before.horario) ?? 'sem horário'} → ${hour(after.horario) ?? 'sem horário'}`,
    );
  }
  if (before.meta_kcal !== after.meta_kcal) {
    changed(`meta ${number(before.meta_kcal)} → ${number(after.meta_kcal)} kcal`);
  }
  if (before.meta_proteinas_g !== after.meta_proteinas_g) {
    changed(`proteína ${number(before.meta_proteinas_g)} → ${number(after.meta_proteinas_g)} g`);
  }
  if ((before.observacao ?? '').trim() !== (after.observacao ?? '').trim()) {
    changed('observações alteradas');
  }

  const foodsBefore = foodKeys(before);
  const foodsAfter = foodKeys(after);
  for (const [key, food] of foodsAfter) {
    const old = foodsBefore.get(key);
    if (!old) {
      changes.push({
        kind: 'added',
        text: `${prefix}+ ${food.nome_alimento} (${number(food.quantidade_g)} g)`,
      });
    } else if (old.quantidade_g !== food.quantidade_g) {
      changed(
        `${food.nome_alimento} ${number(old.quantidade_g)} g → ${number(food.quantidade_g)} g`,
      );
    }
  }
  for (const [key, food] of foodsBefore) {
    if (!foodsAfter.has(key)) {
      changes.push({ kind: 'removed', text: `${prefix}− ${food.nome_alimento}` });
    }
  }
  return changes;
}

/**
 * O que mudou de [previous] para [current]. Sem versão anterior, é o plano
 * criado; sem diferenças nos dados, a lista vem vazia. Os blocos são
 * comparados pelo nome, porque os ids mudam a cada versão.
 */
export function diffPlans(previous: Plan | null, current: Plan): PlanChange[] {
  if (!previous) return [{ kind: 'added', text: 'Plano criado' }];

  const changes: PlanChange[] = [];
  if (previous.titulo.trim() !== current.titulo.trim()) {
    changes.push({
      kind: 'changed',
      text: `Título: ${quote(previous.titulo)} → ${quote(current.titulo)}`,
    });
  }
  if ((previous.observacao ?? '').trim() !== (current.observacao ?? '').trim()) {
    changes.push({ kind: 'changed', text: 'Orientações gerais alteradas' });
  }

  const before = new Map(previous.refeicoes.map((meal) => [norm(meal.nome), meal]));
  const after = new Set(current.refeicoes.map((meal) => norm(meal.nome)));
  for (const meal of current.refeicoes) {
    const old = before.get(norm(meal.nome));
    if (old) changes.push(...diffMeal(old, meal));
    else changes.push({ kind: 'added', text: `Refeição ${quote(meal.nome)} adicionada` });
  }
  for (const meal of previous.refeicoes) {
    if (!after.has(norm(meal.nome))) {
      changes.push({ kind: 'removed', text: `Refeição ${quote(meal.nome)} removida` });
    }
  }
  return changes;
}

const SAO_PAULO = 'America/Sao_Paulo';

/** `05/11/2026 às 09:30`, sempre no horário de Brasília. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} às ${get('hour')}:${get('minute')}`;
}
