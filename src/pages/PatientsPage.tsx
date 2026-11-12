/**
 * Pacientes vinculados ao nutricionista (Task 1.5 [Front], RF15): lista com
 * busca e opção de desvincular.
 */

import { useCallback, useEffect, useState } from 'react';
import { EvolutionReport } from '@/pages/EvolutionReport';
import { FormAlert } from '@/components/FormAlert';
import { TextField } from '@/components/TextField';
import { describeLinkError } from '@/lib/linkErrors';
import { listPatients, unlinkPatient } from '@/lib/linksApi';
import type { LinkedPatient } from '@/types/links';

const SEARCH_DELAY_MS = 300;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

export function PatientsPage() {
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
          {patients.map((patient) => (
            <li key={patient.id} className="patients__item">
              <div className="patients__info">
                <strong>{patient.name}</strong>
                <span>{patient.email}</span>
                <span>Vinculado em {formatDate(patient.linkedAt)}</span>
              </div>

              <EvolutionReport patientId={patient.id} />
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
              )}
            </li>
          ))}
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
