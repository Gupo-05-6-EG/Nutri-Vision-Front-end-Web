/**
 * Pacientes vinculados ao nutricionista (Task 1.5 [Front], RF15) com alertas
 * visuais de abandono (Task 5.2 [Front], RF10.1): lista com busca, ícone
 * vermelho quando `streak == 0` por 3 dias consecutivos, atalho para o
 * dashboard de desempenho e opção de desvincular.
 */

import { useCallback, useEffect, useState } from 'react';
import { FormAlert } from '@/components/FormAlert';
import { TextField } from '@/components/TextField';
import { describeLinkError } from '@/lib/linkErrors';
import { hasAbandonmentAlert, listPatients, unlinkPatient } from '@/lib/linksApi';
import type { LinkedPatient } from '@/types/links';

const SEARCH_DELAY_MS = 300;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

export interface PatientsPageProps {
  onSelectPatientDashboard?: (patient: LinkedPatient) => void;
}

export function PatientsPage({ onSelectPatientDashboard }: PatientsPageProps = {}) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // A busca só vai para a API depois que a pessoa para de digitar.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPatients(query)
      .then((result) => {
        if (!cancelled) setPatients(result);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(describeLinkError(failure));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, reloadKey]);

  const handleUnlink = useCallback(async (patient: LinkedPatient) => {
    setUnlinkingId(patient.id);
    setActionError(null);
    try {
      await unlinkPatient(patient.id);
      setPatients((current) => current.filter((item) => item.id !== patient.id));
      setConfirmingId(null);
    } catch (failure: unknown) {
      setActionError(describeLinkError(failure));
    } finally {
      setUnlinkingId(null);
    }
  }, []);

  const searching = query.trim() !== '';

  return (
    <section className="card patients" aria-labelledby="patients-title">
      <h2 id="patients-title">Pacientes vinculados</h2>

      <TextField
        label="Buscar paciente"
        type="search"
        placeholder="Nome ou e-mail"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {error && <FormAlert message={error} />}
      {actionError && <FormAlert message={actionError} />}

      {loading && <p className="patients__empty">Carregando…</p>}

      {!loading && !error && patients.length === 0 && (
        <p className="patients__empty">
          {searching
            ? 'Nenhum paciente encontrado para essa busca.'
            : 'Você ainda não tem pacientes vinculados.'}
        </p>
      )}

      {!loading && patients.length > 0 && (
        <ul className="patients__list">
          {patients.map((patient) => {
            const abandoned = hasAbandonmentAlert(patient);
            return (
              <li key={patient.id} className="patients__item">
                <div className="patients__info">
                  <div className="patients__title-row">
                    <strong>{patient.name}</strong>
                    {abandoned && (
                      <span
                        className="abandonment-badge"
                        role="status"
                        aria-label={`Alerta de abandono: ${patient.name} com ofensiva zerada por 3 ou mais dias consecutivos`}
                        title="Alerta de abandono: streak zerado por 3 ou mais dias consecutivos"
                      >
                        <svg
                          className="abandonment-badge__icon"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path
                            fill="currentColor"
                            d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z"
                          />
                        </svg>
                        Alerta de abandono
                      </span>
                    )}
                    {typeof patient.streak === 'number' && !abandoned && (
                      <span className="streak-pill">Ofensiva: {patient.streak}d</span>
                    )}
                  </div>
                  <span>{patient.email}</span>
                  <span>Vinculado em {formatDate(patient.linkedAt)}</span>
                </div>

                {confirmingId === patient.id ? (
                  <div className="patients__actions">
                    <span>Desvincular {patient.name}?</span>
                    <button
                      type="button"
                      className="button button--danger"
                      disabled={unlinkingId === patient.id}
                      onClick={() => void handleUnlink(patient)}
                    >
                      {unlinkingId === patient.id ? 'Desvinculando…' : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      className="button button--secondary"
                      disabled={unlinkingId === patient.id}
                      onClick={() => setConfirmingId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="patients__actions">
                    {onSelectPatientDashboard && (
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => onSelectPatientDashboard(patient)}
                      >
                        Ver desempenho
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => {
                        setActionError(null);
                        setConfirmingId(patient.id);
                      }}
                    >
                      Desvincular
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <button type="button" className="link" onClick={() => setReloadKey((key) => key + 1)}>
          Tentar de novo
        </button>
      )}
    </section>
  );
}
