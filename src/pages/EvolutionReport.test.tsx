import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { EvolutionReport } from './EvolutionReport';
import { downloadPdf } from '@/lib/api';

vi.mock('@/lib/api', () => ({ downloadPdf: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('recusa período inválido antes de consultar dados clínicos', async () => {
  const user = userEvent.setup();
  render(<EvolutionReport patientId={7} />);
  await user.click(screen.getByRole('button', { name: 'Exportar PDF' }));
  expect(screen.getByRole('alert')).toHaveTextContent('1 a 90 dias');
  expect(downloadPdf).not.toHaveBeenCalled();
});

it('envia paciente e período e permite tentar novamente após falha', async () => {
  const user = userEvent.setup();
  vi.mocked(downloadPdf).mockRejectedValue(new Error('Sem vínculo'));
  render(<EvolutionReport patientId={7} />);
  await user.type(screen.getByLabelText('Data inicial'), '2026-11-01');
  await user.type(screen.getByLabelText('Data final'), '2026-11-07');
  await user.click(screen.getByRole('button', { name: 'Exportar PDF' }));
  expect(downloadPdf).toHaveBeenCalledWith(
    '/pacientes/7/relatorio.pdf?inicio=2026-11-01&fim=2026-11-07',
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível exportar');
  expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled();
});
