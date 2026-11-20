/**
 * Carteira do nutricionista: visão geral (BE-13), ficha do paciente (BE-11) e
 * incentivo de XP (BE-07).
 */

import { api } from '@/lib/api';

export type Situation = 'ativo' | 'em_risco' | 'pendente';
export type SituationFilter = 'todos' | 'ativos' | 'em_risco' | 'pendentes';

export interface MonitoredPatient {
  paciente_id: number;
  nome: string;
  email: string;
  status_vinculo: string;
  vinculado_em: string;
  situacao: Situation;
  motivo_risco: 'alerta_desvio' | 'sem_registro' | null;
  meta_kcal: number | null;
  consumo_hoje_kcal: number;
  adesao_semanal_pct: number | null;
  ofensiva: number;
  xp: number;
  alertas_nao_lidos: number;
  ultimo_registro: { tipo: string; em: string } | null;
}

export interface Overview {
  indicadores: {
    pacientes_ativos: number;
    pacientes_pendentes: number;
    alertas_criticos: number;
    adesao_media_pct: number | null;
    ofensiva_media_dias: number | null;
  };
  contagens: Record<SituationFilter, number>;
  total: number;
  pagina: number;
  por_pagina: number;
  pacientes: MonitoredPatient[];
}

export interface OverviewQuery {
  status?: SituationFilter;
  busca?: string;
  pagina?: number;
  porPagina?: number;
}

export function getOverview({
  status = 'todos',
  busca = '',
  pagina = 1,
  porPagina = 10,
}: OverviewQuery = {}): Promise<Overview> {
  const params = new URLSearchParams({
    status,
    pagina: String(pagina),
    por_pagina: String(porPagina),
  });
  if (busca.trim()) params.set('busca', busca.trim());
  return api.get<Overview>(`/nutricionista/visao-geral?${params.toString()}`);
}

export interface DailyGoal {
  kcal: number | null;
  proteinas_g: number | null;
  carboidratos_g: number | null;
  gorduras_g: number | null;
  origem: 'plano' | 'triagem' | null;
}

export interface PatientProfile {
  paciente_id: number;
  nome: string;
  email: string;
  membro_desde: string;
  idade: number | null;
  genero: string | null;
  peso_kg: number | null;
  altura_cm: number | null;
  imc: number | null;
  classificacao_imc: string | null;
  tmb_kcal: number | null;
  nivel_atividade: string | null;
  fator_atividade: number | null;
  meta: DailyGoal;
  gamificacao: {
    xp: number;
    ofensiva: number;
    divisao: string;
    refeicoes_registradas: number;
  };
  plano_ativo: { id: number; titulo: string; versao: number } | null;
}

export function getPatientProfile(patientId: number): Promise<PatientProfile> {
  return api.get<PatientProfile>(`/pacientes/${patientId}/perfil`);
}

export interface IncentiveResult {
  paciente_id: number;
  xp_concedido: number;
  xp_total: number;
}

export function giveIncentive(patientId: number): Promise<IncentiveResult> {
  return api.post<IncentiveResult>(`/pacientes/${patientId}/incentivo`, {});
}

export const MEAL_LABELS: Record<string, string> = {
  cafe_da_manha: 'Café da manhã',
  almoco: 'Almoço',
  lanche: 'Lanche',
  jantar: 'Jantar',
};

export const ACTIVITY_LABELS: Record<string, string> = {
  sedentario: 'Sedentário',
  leve: 'Leve',
  moderado: 'Moderado',
  intenso: 'Intenso',
  muito_intenso: 'Muito intenso',
};

/** "há 3 h", "há 2 dias", "agora". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} dias`;
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** CSV da carteira (separador `;`, como o Excel em português abre direto). */
export function overviewToCsv(patients: MonitoredPatient[]): string {
  const header = [
    'Paciente',
    'E-mail',
    'Situação',
    'Meta diária (kcal)',
    'Consumo hoje (kcal)',
    'Adesão semanal (%)',
    'Ofensiva (dias)',
    'XP',
    'Alertas não lidos',
    'Último registro',
  ];
  const situation: Record<Situation, string> = {
    ativo: 'Ativo',
    em_risco: 'Em risco',
    pendente: 'Pendente',
  };
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = patients.map((p) =>
    [
      p.nome,
      p.email,
      situation[p.situacao],
      p.meta_kcal ?? '',
      p.consumo_hoje_kcal,
      p.adesao_semanal_pct ?? '',
      p.ofensiva,
      p.xp,
      p.alertas_nao_lidos,
      p.ultimo_registro ? new Date(p.ultimo_registro.em).toLocaleString('pt-BR') : '',
    ]
      .map(cell)
      .join(';'),
  );
  return [header.join(';'), ...rows].join('\n');
}

/** Baixa um texto como arquivo no navegador. */
export function downloadText(contents: string, filename: string, type: string): void {
  const blob = new Blob([`﻿${contents}`], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
