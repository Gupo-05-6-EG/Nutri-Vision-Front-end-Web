import { api } from '@/lib/api';
import type { LinkedPatient, LinkStatus } from '@/types/links';

/**
 * Gestão de vínculos do nutricionista (Task 1.5 [Back]): lista os pacientes
 * vinculados e encerra um vínculo.
 */
const PATIENTS_PATH = '/patients';

interface PatientResponse {
  paciente_id: number;
  nome: string;
  email: string;
  status: LinkStatus;
  vinculado_em?: string | null;
}

/** Lista os pacientes vinculados; `search` filtra por nome ou e-mail no servidor. */
export async function listPatients(search = ''): Promise<LinkedPatient[]> {
  const term = search.trim();
  const query = term ? `?busca=${encodeURIComponent(term)}` : '';
  const data = await api.get<PatientResponse[] | undefined>(`${PATIENTS_PATH}${query}`);

  return (data ?? []).map((patient) => ({
    id: patient.paciente_id,
    name: patient.nome,
    email: patient.email,
    status: patient.status,
    linkedAt: patient.vinculado_em ?? null,
  }));
}

/** Desvincula o paciente (o vínculo passa a `encerrado`). */
export async function unlinkPatient(patientId: number): Promise<void> {
  await api.delete(`${PATIENTS_PATH}/${patientId}`);
}
