/**
 * Construtor de planos alimentares (RF09.1): chamadas da API e o rascunho do
 * formulário.
 *
 * O formulário trabalha com um rascunho (`PlanDraft`) de strings, do jeito que
 * os inputs devolvem; só na hora de enviar ele vira o `PlanInput` da API. As
 * regras de validação repetem as do back-end para o erro aparecer no campo,
 * antes de ir para a rede.
 */

import { ApiError, api } from '@/lib/api';
import type { Plan, PlanInput, TacoFood } from '@/types/plan';

// Limites do back-end (app/schemas/plano_alimentar.py).
export const LIMITS = {
  title: 120,
  planNote: 1000,
  mealName: 60,
  mealNote: 500,
  foodName: 160,
  meals: 12,
  foodsPerMeal: 50,
  goalKcal: 10000,
  goalProtein: 1000,
  grams: 5000,
} as const;

export interface FoodDraft {
  key: string;
  name: string;
  grams: string;
  tacoId: number | null;
  /** Valores por 100g, quando o alimento veio da busca (para a estimativa). */
  taco: TacoFood | null;
}

export interface MealDraft {
  key: string;
  name: string;
  /** `HH:MM` ou vazio. */
  time: string;
  goalKcal: string;
  goalProtein: string;
  /** Opcionais: vazio = sem meta de carboidrato/gordura neste bloco. */
  goalCarbs: string;
  goalFat: string;
  note: string;
  foods: FoodDraft[];
}

export interface PlanDraft {
  title: string;
  note: string;
  meals: MealDraft[];
}

/** Erros por campo. A chave é `title`, `meals` ou `<key do bloco/alimento>.<campo>`. */
export type DraftErrors = Record<string, string>;

let nextKey = 0;
const newKey = () => `k${++nextKey}`;

export const emptyFood = (): FoodDraft => ({
  key: newKey(),
  name: '',
  grams: '',
  tacoId: null,
  taco: null,
});

export const emptyMeal = (name = ''): MealDraft => ({
  key: newKey(),
  name,
  time: '',
  goalKcal: '',
  goalProtein: '',
  goalCarbs: '',
  goalFat: '',
  note: '',
  foods: [emptyFood()],
});

export const emptyDraft = (): PlanDraft => ({
  title: '',
  note: '',
  meals: [emptyMeal('Café da manhã')],
});

/** Sugestões de nome para um bloco novo, na ordem do dia. */
export const MEAL_NAME_SUGGESTIONS = [
  'Café da manhã',
  'Lanche da manhã',
  'Almoço',
  'Lanche da tarde',
  'Jantar',
  'Ceia',
];

/** Aceita vírgula ou ponto como separador decimal. Vazio ou inválido vira `NaN`. */
export function parseNumber(value: string): number {
  const normalized = value.trim().replace(',', '.');
  return normalized === '' ? Number.NaN : Number(normalized);
}

function checkNumber(
  errors: DraftErrors,
  key: string,
  value: string,
  { max, allowZero }: { max: number; allowZero: boolean },
): void {
  const number = parseNumber(value);
  if (Number.isNaN(number)) errors[key] = 'Informe um número.';
  else if (allowZero ? number < 0 : number <= 0)
    errors[key] = allowZero ? 'Não pode ser negativo.' : 'Deve ser maior que zero.';
  else if (number > max) errors[key] = `Máximo ${max.toLocaleString('pt-BR')}.`;
}

export function validateDraft(draft: PlanDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.title.trim()) errors.title = 'Dê um título ao plano.';
  if (draft.meals.length === 0) errors.meals = 'Adicione pelo menos uma refeição.';
  if (draft.meals.length > LIMITS.meals) errors.meals = `No máximo ${LIMITS.meals} refeições.`;

  for (const meal of draft.meals) {
    if (!meal.name.trim()) errors[`${meal.key}.name`] = 'Dê um nome à refeição.';
    checkNumber(errors, `${meal.key}.goalKcal`, meal.goalKcal, {
      max: LIMITS.goalKcal,
      allowZero: true,
    });
    checkNumber(errors, `${meal.key}.goalProtein`, meal.goalProtein, {
      max: LIMITS.goalProtein,
      allowZero: true,
    });
    for (const field of ['goalCarbs', 'goalFat'] as const) {
      if (meal[field].trim()) {
        checkNumber(errors, `${meal.key}.${field}`, meal[field], {
          max: LIMITS.goalProtein * 2,
          allowZero: true,
        });
      }
    }
    if (meal.foods.length === 0) errors[`${meal.key}.foods`] = 'Adicione pelo menos um alimento.';
    if (meal.foods.length > LIMITS.foodsPerMeal)
      errors[`${meal.key}.foods`] = `No máximo ${LIMITS.foodsPerMeal} alimentos.`;

    for (const food of meal.foods) {
      if (!food.name.trim()) errors[`${food.key}.name`] = 'Informe o alimento.';
      checkNumber(errors, `${food.key}.grams`, food.grams, {
        max: LIMITS.grams,
        allowZero: false,
      });
    }
  }
  return errors;
}

const optional = (value: string) => value.trim() || null;
const twoDecimals = (value: string) => Math.round(parseNumber(value) * 100) / 100;

/** Rascunho -> corpo do `POST`. Chame só com o rascunho válido. */
export function toPayload(draft: PlanDraft): PlanInput {
  return {
    titulo: draft.title.trim(),
    observacao: optional(draft.note),
    refeicoes: draft.meals.map((meal) => ({
      nome: meal.name.trim(),
      horario: meal.time || null,
      meta_kcal: twoDecimals(meal.goalKcal),
      meta_proteinas_g: twoDecimals(meal.goalProtein),
      meta_carboidratos_g: meal.goalCarbs.trim() ? twoDecimals(meal.goalCarbs) : null,
      meta_gorduras_g: meal.goalFat.trim() ? twoDecimals(meal.goalFat) : null,
      observacao: optional(meal.note),
      alimentos: meal.foods.map((food) => ({
        nome_alimento: food.name.trim(),
        quantidade_g: twoDecimals(food.grams),
        alimento_taco_id: food.tacoId,
      })),
    })),
  };
}

const formatNumber = (value: number) => String(value).replace('.', ',');

/** Plano da API -> rascunho, para partir do plano ativo. */
export function fromPlan(plan: Plan): PlanDraft {
  return {
    title: plan.titulo,
    note: plan.observacao ?? '',
    meals: plan.refeicoes.map((meal) => ({
      key: newKey(),
      name: meal.nome,
      time: meal.horario?.slice(0, 5) ?? '',
      goalKcal: formatNumber(meal.meta_kcal),
      goalProtein: formatNumber(meal.meta_proteinas_g),
      goalCarbs: meal.meta_carboidratos_g == null ? '' : formatNumber(meal.meta_carboidratos_g),
      goalFat: meal.meta_gorduras_g == null ? '' : formatNumber(meal.meta_gorduras_g),
      note: meal.observacao ?? '',
      foods: meal.alimentos.map((food) => ({
        key: newKey(),
        name: food.nome_alimento,
        grams: formatNumber(food.quantidade_g),
        tacoId: food.alimento_taco_id,
        taco: null,
      })),
    })),
  };
}

export interface Estimate {
  kcal: number;
  protein: number;
  /** Quantos alimentos do bloco têm valores da TACO carregados. */
  counted: number;
}

/** Kcal e proteínas dos alimentos escolhidos da busca da TACO no bloco. */
export function estimateMeal(meal: MealDraft): Estimate {
  let kcal = 0;
  let protein = 0;
  let counted = 0;
  for (const food of meal.foods) {
    const grams = parseNumber(food.grams);
    if (!food.taco || Number.isNaN(grams)) continue;
    kcal += (food.taco.kcal_100g * grams) / 100;
    protein += (food.taco.prot_100g * grams) / 100;
    counted++;
  }
  return { kcal, protein, counted };
}

/** Soma das metas válidas dos blocos (o que o back-end devolve em `totais`). */
export function draftGoals(draft: PlanDraft): {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  const sum = (field: 'goalKcal' | 'goalProtein' | 'goalCarbs' | 'goalFat') =>
    draft.meals.reduce((total, meal) => {
      const value = parseNumber(meal[field]);
      return Number.isNaN(value) ? total : total + value;
    }, 0);
  return {
    kcal: sum('goalKcal'),
    protein: sum('goalProtein'),
    carbs: sum('goalCarbs'),
    fat: sum('goalFat'),
  };
}

/** `detail` do FastAPI quando vier, senão a mensagem do erro. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    try {
      const detail = (JSON.parse(error.message) as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
    } catch {
      // corpo não era JSON
    }
    return `Erro ${error.status} na API.`;
  }
  return error instanceof Error ? error.message : 'Falha inesperada.';
}

export const createPlan = (patientId: number, plan: PlanInput) =>
  api.post<Plan>(`/pacientes/${patientId}/planos`, plan);

/** Plano ativo do paciente, ou `null` se ele ainda não tiver um. */
export async function getActivePlan(patientId: number): Promise<Plan | null> {
  try {
    return await api.get<Plan>(`/pacientes/${patientId}/planos/ativo`);
  } catch (error) {
    if (error instanceof ApiError && describeError(error) === 'Paciente sem plano ativo') {
      return null;
    }
    throw error;
  }
}

export const searchTaco = (name: string) =>
  api.get<TacoFood[]>(`/alimentos-taco?nome=${encodeURIComponent(name)}&limite=8`);

/** Rascunho salvo do plano (BE-12), ou `null` se não houver. */
export async function getDraft(patientId: number): Promise<Plan | null> {
  try {
    return await api.get<Plan>(`/pacientes/${patientId}/planos/rascunho`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export const saveDraft = (patientId: number, plan: PlanInput) =>
  api.put<Plan>(`/pacientes/${patientId}/planos/rascunho`, plan);

export async function discardDraft(patientId: number): Promise<void> {
  try {
    await api.delete(`/pacientes/${patientId}/planos/rascunho`);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
}
