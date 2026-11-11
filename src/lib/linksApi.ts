import { api } from '@/lib/api';
import type { LinkedPatient, LinkStatus } from '@/types/links';

/**
 * Gestão de vínculos do nutricionista (Task 1.5 [Back]): lista os pacientes
 * vinculados e encerra um vínculo. Também expõe os campos de ofensiva/abandono
 * para o gatilho visual de alerta (Task 5.2, RF10.1).
 */
const PATIENTS_PATH = '/patients';

export const ABANDONMENT_THRESHOLD_DAYS = 3;

interface PatientResponse {
  paciente_id: number;
  nome: string;
  email: string;
  status: LinkStatus;
  vinculado_em?: string | null;
  streak?: number | null;
  dias_streak_zero?: number | null;
  dias_sem_streak?: number | null;
  alerta_abandono?: boolean | null;
}

/**
 * Verifica se o paciente atingiu o gatilho de alerta de abandono (RF10.1):
 * `streak === 0` por pelo menos 3 dias consecutivos (ou flag explícita do backend).
 */
export function hasAbandonmentAlert(patient: LinkedPatient): boolean {
  if (patient.abandonmentAlert === true) return true;
  const zeroDays = patient.zeroStreakDays ?? 0;
  const streak = patient.streak ?? (zeroDays > 0 ? 0 : undefined);
  return streak === 0 && zeroDays >= ABANDONMENT_THRESHOLD_DAYS;
}

/** Lista os pacientes vinculados; `search` filtra por nome ou e-mail no servidor. */
export async function listPatients(search = ''): Promise<LinkedPatient[]> {
  const term = search.trim();
  const query = term ? `?busca=${encodeURIComponent(term)}` : '';
  const data = await api.get<PatientResponse[] | undefined>(`${PATIENTS_PATH}${query}`);

  return (data ?? []).map((patient) => {
    const zeroDays = patient.dias_streak_zero ?? patient.dias_sem_streak ?? undefined;
    return {
      id: patient.paciente_id,
      name: patient.nome,
      email: patient.email,
      status: patient.status,
      linkedAt: patient.vinculado_em ?? null,
      streak: patient.streak ?? undefined,
      zeroStreakDays: zeroDays ?? undefined,
      abandonmentAlert: patient.alerta_abandono ?? undefined,
    };
  });
}

/** Desvincula o paciente (o vínculo passa a `encerrado`). */
export async function unlinkPatient(patientId: number): Promise<void> {
  await api.delete(`${PATIENTS_PATH}/${patientId}`);
}
