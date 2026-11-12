/**
 * Contratos da API de plano alimentar (RF09.1) e da busca na TACO.
 *
 * Espelham os schemas do back-end (`app/schemas/plano_alimentar.py`): valores
 * nutricionais chegam como número e horários como `HH:MM:SS`.
 */

export interface PlanFoodInput {
  nome_alimento: string;
  quantidade_g: number;
  alimento_taco_id?: number | null;
}

export interface PlanMealInput {
  nome: string;
  horario?: string | null;
  meta_kcal: number;
  meta_proteinas_g: number;
  observacao?: string | null;
  alimentos: PlanFoodInput[];
}

export interface PlanInput {
  titulo: string;
  observacao?: string | null;
  refeicoes: PlanMealInput[];
}

export interface PlanFood {
  id: number;
  nome_alimento: string;
  quantidade_g: number;
  alimento_taco_id: number | null;
}

export interface PlanMeal {
  id: number;
  nome: string;
  horario: string | null;
  meta_kcal: number;
  meta_proteinas_g: number;
  observacao: string | null;
  alimentos: PlanFood[];
}

export interface Plan {
  id: number;
  paciente_id: number;
  nutricionista_id: number | null;
  titulo: string;
  observacao: string | null;
  ativo: boolean;
  criado_em: string;
  refeicoes: PlanMeal[];
  totais: { meta_kcal: number; meta_proteinas_g: number };
}

/** Quem salvou uma versão do plano (Task 5.3). */
export interface PlanAuthor {
  id: number;
  nome: string;
}

/** Uma versão do plano no histórico: o plano completo, a numeração e o autor. */
export interface PlanVersion extends Plan {
  versao: number;
  autor: PlanAuthor | null;
}

export interface TacoFood {
  id: number;
  nome: string;
  categoria: string;
  kcal_100g: number;
  carbs_100g: number;
  prot_100g: number;
  gord_100g: number;
}
