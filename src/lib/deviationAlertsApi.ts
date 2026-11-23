/**
 * Cliente HTTP e formatadores para regras e alertas de desvio de meta (Task 5.4, RF10.2).
 */

import { api } from '@/lib/api';
import type {
  DeviationAlert,
  DeviationAlertRule,
  DeviationAlertRuleInput,
  DeviationDirection,
  ProcessDeviationAlertsResult,
} from '@/types/deviationAlerts';

export function getDeviationRule(): Promise<DeviationAlertRule> {
  return api.get<DeviationAlertRule>('/alertas-desvio/regra');
}

export function saveDeviationRule(input: DeviationAlertRuleInput): Promise<DeviationAlertRule> {
  return api.put<DeviationAlertRule>('/alertas-desvio/regra', input);
}

export function listDeviationAlerts(options?: {
  patientId?: number;
  unreadOnly?: boolean;
}): Promise<DeviationAlert[]> {
  const params = new URLSearchParams();
  if (options?.patientId) params.set('paciente_id', String(options.patientId));
  if (options?.unreadOnly) params.set('apenas_nao_lidos', 'true');
  const query = params.toString();
  return api.get<DeviationAlert[]>(query ? `/alertas-desvio?${query}` : '/alertas-desvio');
}

export function processDeviationAlerts(): Promise<ProcessDeviationAlertsResult> {
  return api.post<ProcessDeviationAlertsResult>('/alertas-desvio/processar', {});
}

export function markDeviationAlertAsRead(alertId: number): Promise<DeviationAlert> {
  return api.patch<DeviationAlert>(`/alertas-desvio/${alertId}/lido`);
}

export function formatDirectionLabel(direction: DeviationDirection): string {
  switch (direction) {
    case 'acima':
      return 'Acima da meta';
    case 'abaixo':
      return 'Abaixo da meta';
    case 'ambos':
      return 'Oscilação acima/abaixo';
  }
}

export function validateDeviationRule(
  percentText: string,
  daysText: string,
): { percent?: string; days?: string; parsed?: { percent: number; days: number } } {
  const normalizedPercent = Number(percentText.trim().replace(',', '.'));
  const normalizedDays = Number(daysText.trim());

  const errors: { percent?: string; days?: string } = {};
  if (!Number.isFinite(normalizedPercent) || normalizedPercent <= 0 || normalizedPercent > 100) {
    errors.percent = 'Informe um percentual entre 1% e 100%.';
  }
  if (!Number.isInteger(normalizedDays) || normalizedDays < 1 || normalizedDays > 30) {
    errors.days = 'Informe entre 1 e 30 dias consecutivos.';
  }
  if (errors.percent || errors.days) return errors;

  return { parsed: { percent: normalizedPercent, days: normalizedDays } };
}
