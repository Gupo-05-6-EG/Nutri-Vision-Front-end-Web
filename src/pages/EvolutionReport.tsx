import { useState } from 'react';
import { downloadPdf } from '@/lib/api';

export function EvolutionReport({ patientId }: { patientId: number }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    setError('');
    const days = (Date.parse(end) - Date.parse(start)) / 86400000;
    if (!start || !end || !Number.isFinite(days) || days < 0 || days > 89) {
      setError('Escolha um período de 1 a 90 dias.');
      return;
    }
    setBusy(true);
    try {
      const blob = await downloadPdf(
        `/pacientes/${patientId}/relatorio.pdf?inicio=${start}&fim=${end}`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evolucao-${patientId}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Não foi possível exportar. Verifique a conexão e o vínculo com o paciente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset disabled={busy}>
      <legend>Relatório de evolução</legend>
      <label>
        Data inicial <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label>
        Data final <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <button type="button" className="button button--secondary" onClick={() => void download()}>
        {busy ? 'Exportando…' : 'Exportar PDF'}
      </button>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
