/**
 * Cliente e regras de consolidação do dashboard clínico de 7 dias e alertas de
 * abandono (Task 5.2, RF07.1, RF10.1).
 */

import { api } from '@/lib/api';
import { getActivePlan } from '@/lib/plans';
import type { DailyCaloriesPoint, PatientDashboardData } from '@/types/dashboard';

export const WINDOW_DAYS = 7;
export const ADHERENCE_TOLERANCE = 0.15;

interface DailyConsumptionResponse {
  paciente_id: number;
  data: string;
  quantidade_refeicoes?: number;
  totais?: {
    calorias_kcal?: number;
    proteinas_g?: number;
    carboidratos_g?: number;
    gorduras_g?: number;
  };
}

/** Formata um `Date` (UTC) como `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Converte `YYYY-MM-DD` para rótulo curto `DD/MM`. */
export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}`;
}

/**
 * Gera as 7 datas (`YYYY-MM-DD`) terminando em `referenceDate` (inclusive), em
 * ordem cronológica (do dia mais antigo ao mais recente).
 */
export function lastSevenDays(referenceDate: Date = new Date()): string[] {
  const end = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  );
  const dates: string[] = [];
  for (let offset = WINDOW_DAYS - 1; offset >= 0; offset--) {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - offset);
    dates.push(toIsoDate(day));
  }
  return dates;
}

/**
 * Verifica se o paciente teve pelo menos `minConsecutiveDays` dias consecutivos
 * sem registro (`mealCount === 0` e `consumedKcal === 0`) no final da janela,
 * indicando abandono recente da ofensiva (`streak === 0` por 3 dias seguidos).
 */
export function hasConsecutiveInactivity(
  days: DailyCaloriesPoint[],
  minConsecutiveDays = 3,
): boolean {
  if (days.length < minConsecutiveDays) return false;
  const tail = days.slice(-minConsecutiveDays);
  return tail.every((point) => point.mealCount === 0 && point.consumedKcal === 0);
}

/** Busca o consumo diário de um paciente numa data (`GET /refeicoes/consumo-diario`). */
export async function getDailyConsumption(
  patientId: number,
  isoDate: string,
): Promise<{ consumedKcal: number; mealCount: number }> {
  const response = await api.get<DailyConsumptionResponse>(
    `/refeicoes/consumo-diario?paciente_id=${patientId}&data=${encodeURIComponent(isoDate)}`,
  );
  return {
    consumedKcal: Math.round((response.totais?.calorias_kcal ?? 0) * 100) / 100,
    mealCount: response.quantidade_refeicoes ?? 0,
  };
}

/**
 * Carrega o plano ativo e o consumo dos últimos 7 dias do paciente e monta a
 * série comparativa "Meta Calórica vs Consumo Real" (RF07.1).
 */
export async function fetchPatientDashboard(
  patientId: number,
  referenceDate: Date = new Date(),
): Promise<PatientDashboardData> {
  const dates = lastSevenDays(referenceDate);
  const [plan, ...dailyList] = await Promise.all([
    getActivePlan(patientId),
    ...dates.map((date) => getDailyConsumption(patientId, date)),
  ]);

  const goalKcal = Math.round((plan?.totais.meta_kcal ?? 0) * 100) / 100;
  const days: DailyCaloriesPoint[] = dates.map((date, index) => ({
    date,
    label: formatShortDate(date),
    consumedKcal: dailyList[index].consumedKcal,
    goalKcal,
    mealCount: dailyList[index].mealCount,
  }));

  const totalConsumed = days.reduce((sum, item) => sum + item.consumedKcal, 0);
  const averageConsumedKcal = Math.round(totalConsumed / days.length);

  const adherenceDays =
    goalKcal > 0
      ? days.filter(
          (item) =>
            item.consumedKcal > 0 &&
            Math.abs(item.consumedKcal - goalKcal) <= goalKcal * ADHERENCE_TOLERANCE,
        ).length
      : 0;

  return {
    patientId,
    planTitle: plan?.titulo ?? null,
    goalKcal,
    averageConsumedKcal,
    adherenceDays,
    days,
  };
}
