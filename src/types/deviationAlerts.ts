/**
 * Contratos de regras e alertas de desvio significativo do plano (Task 5.4, RF10.2).
 */

export type DeviationDirection = 'acima' | 'abaixo' | 'ambos';

export interface DeviationAlertRule {
  nutricionista_id: number;
  percentual_desvio: number;
  dias_consecutivos: number;
  ativo: boolean;
}

export interface DeviationAlertRuleInput {
  percentual_desvio: number;
  dias_consecutivos: number;
  ativo: boolean;
}

export interface DeviationAlert {
  id: number;
  nutricionista_id: number;
  paciente_id: number;
  paciente_nome: string;
  paciente_email: string;
  data_referencia: string;
  direcao: DeviationDirection;
  dias_consecutivos: number;
  percentual_limite: number;
  percentual_medio_desvio: number;
  meta_kcal: number;
  consumo_medio_kcal: number;
  lido: boolean;
  notificado_em: string | null;
  criado_em: string;
}

export interface ProcessDeviationAlertsResult {
  data_referencia: string;
  alertas_gerados: number;
}
