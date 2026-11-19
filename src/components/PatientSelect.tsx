/**
 * Seletor de paciente por nome e e-mail (no lugar de digitar o id), usado no
 * construtor e no histórico do plano.
 */

import { useEffect, useId, useState } from 'react';
import { listPatients } from '@/lib/linksApi';
import type { LinkedPatient } from '@/types/links';

interface Props {
  value: string;
  onChange: (patientId: string) => void;
  label?: string;
}

export function PatientSelect({ value, onChange, label = 'Paciente' }: Props) {
  const id = useId();
  const [patients, setPatients] = useState<LinkedPatient[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPatients()
      .then((list) => {
        if (!cancelled) setPatients(list);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">
          {patients === null && !failed ? 'Carregando pacientes…' : 'Selecione o paciente'}
        </option>
        {(patients ?? []).map((patient) => (
          <option key={patient.id} value={String(patient.id)}>
            {patient.name} ({patient.email})
          </option>
        ))}
      </select>
      {failed ? (
        <small className="field__error">Não foi possível carregar os pacientes.</small>
      ) : null}
      {patients?.length === 0 ? (
        <small className="muted">Nenhum paciente com vínculo ativo ainda.</small>
      ) : null}
    </div>
  );
}
