/**
 * Tipos do dashboard clínico e alertas de abandono (Task 5.2, RF07.1, RF10.1).
 */

/** Ponto de um dia na série de 7 dias comparando meta calórica vs consumo real. */
export interface DailyCaloriesPoint {
  /** Data ISO no formato `YYYY-MM-DD`. */
  date: string;
  /** Rótulo curto para o eixo X (ex.: `05/11`). */
  label: string;
  /** Consumo calórico real registrado no dia (kcal). */
  consumedKcal: number;
  /** Meta calórica diária do plano ativo (kcal). */
  goalKcal: number;
  /** Quantidade de refeições registradas no dia. */
  mealCount: number;
}

/** Dados consolidados dos últimos 7 dias para o dashboard do paciente. */
export interface PatientDashboardData {
  patientId: number;
  planTitle: string | null;
  goalKcal: number;
  averageConsumedKcal: number;
  adherenceDays: number;
  days: DailyCaloriesPoint[];
}
