/** Status de um vínculo nutricionista–paciente (Task 1.5 [Back]). */
export type LinkStatus = 'pendente' | 'ativo' | 'recusado' | 'encerrado';

/** Paciente vinculado, como devolvido por `GET /patients`. */
export interface LinkedPatient {
  id: number;
  name: string;
  email: string;
  status: LinkStatus;
  linkedAt: string | null;
}
