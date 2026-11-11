/** Status de um vínculo nutricionista–paciente (Task 1.5 [Back]). */
export type LinkStatus = 'pendente' | 'ativo' | 'recusado' | 'encerrado';

/** Paciente vinculado, como devolvido por `GET /patients`. */
export interface LinkedPatient {
  id: number;
  name: string;
  email: string;
  status: LinkStatus;
  linkedAt: string | null;
  /** Ofensiva atual do paciente (RF16). */
  streak?: number;
  /** Quantos dias consecutivos o paciente está com `streak == 0` (RF10.1). */
  zeroStreakDays?: number;
  /** Sinalizador explícito de abandono quando enviado pelo backend (RF10.1). */
  abandonmentAlert?: boolean;
}
