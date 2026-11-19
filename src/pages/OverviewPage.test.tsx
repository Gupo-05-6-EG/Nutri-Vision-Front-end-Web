import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { overviewToCsv, timeAgo } from '@/lib/portfolioApi';
import type { MonitoredPatient, Overview } from '@/lib/portfolioApi';
import { OverviewPage } from '@/pages/OverviewPage';
import { fakeApi, json } from '@/test/fakeApi';

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

const patient = (overrides: Partial<MonitoredPatient>): MonitoredPatient => ({
  paciente_id: 1,
  nome: 'Mariana Castro',
  email: 'mariana@email.com',
  status_vinculo: 'ativo',
  vinculado_em: '2026-10-01T10:00:00Z',
  situacao: 'ativo',
  motivo_risco: null,
  meta_kcal: 2150,
  consumo_hoje_kcal: 900,
  adesao_semanal_pct: 94,
  ofensiva: 24,
  xp: 800,
  alertas_nao_lidos: 0,
  ultimo_registro: { tipo: 'almoco', em: hoursAgo(1) },
  ...overrides,
});

const overview = (pacientes: MonitoredPatient[]): Overview => ({
  indicadores: {
    pacientes_ativos: 3,
    pacientes_pendentes: 1,
    alertas_criticos: 2,
    adesao_media_pct: 84.5,
    ofensiva_media_dias: 14.2,
  },
  contagens: { todos: 4, ativos: 3, em_risco: 2, pendentes: 1 },
  total: pacientes.length,
  pagina: 1,
  por_pagina: 8,
  pacientes,
});

const rows = [
  patient({}),
  patient({
    paciente_id: 2,
    nome: 'Alex Silva',
    situacao: 'em_risco',
    motivo_risco: 'alerta_desvio',
    adesao_semanal_pct: 58,
    ofensiva: 2,
  }),
  patient({
    paciente_id: 3,
    nome: 'Beatriz Ramos',
    situacao: 'em_risco',
    motivo_risco: 'sem_registro',
    ofensiva: 0,
    ultimo_registro: { tipo: 'jantar', em: hoursAgo(36) },
  }),
  patient({
    paciente_id: 4,
    nome: 'Davi Prado',
    situacao: 'pendente',
    meta_kcal: null,
    adesao_semanal_pct: null,
    ultimo_registro: null,
  }),
];

describe('OverviewPage', () => {
  it('mostra os indicadores e a tabela de monitoramento', async () => {
    fakeApi({ 'GET /nutricionista/visao-geral': () => json(overview(rows)) });
    const onOpen = vi.fn();
    render(<OverviewPage onOpenPatient={onOpen} onInvite={() => {}} />);

    expect(await screen.findByText('Mariana Castro')).toBeInTheDocument();
    expect(screen.getByText('84,5%')).toBeInTheDocument();
    expect(screen.getByText('14,2 dias')).toBeInTheDocument();
    expect(screen.getByText('1 aguardando aceite')).toBeInTheDocument();
    expect(screen.getByText('Almoço registrado há 1 h')).toBeInTheDocument();
    expect(screen.getByText('Desvio da meta')).toBeInTheDocument();
    expect(screen.getByText('Sem registro há 36 h')).toBeInTheDocument();
    expect(screen.getByText('Aguardando aceite')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ver ficha de Alex Silva' }));
    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it('filtra pela situacao com as contagens no seletor', async () => {
    const { calls } = fakeApi({ 'GET /nutricionista/visao-geral': () => json(overview(rows)) });
    render(<OverviewPage onOpenPatient={() => {}} onInvite={() => {}} />);
    await screen.findByText('Mariana Castro');

    const select = screen.getByLabelText('Filtrar pacientes');
    expect(within(select).getByRole('option', { name: 'Em risco (2)' })).toBeInTheDocument();
    await userEvent.setup().selectOptions(select, 'em_risco');

    expect(calls.at(-1)?.path).toContain('status=em_risco');
  });

  it('exporta a carteira em CSV', async () => {
    fakeApi({ 'GET /nutricionista/visao-geral': () => json(overview(rows)) });
    const createUrl = vi.fn(() => 'blob:csv');
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<OverviewPage onOpenPatient={() => {}} onInvite={() => {}} />);
    await screen.findByText('Mariana Castro');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Exportar' }));

    expect(createUrl).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('CSV com cabecalho e situacao em portugues', () => {
    const csv = overviewToCsv([rows[0], rows[3]]);
    const [header, first, second] = csv.split('\n');

    expect(header).toContain('Adesão semanal (%)');
    expect(first).toContain('Mariana Castro;mariana@email.com;Ativo;2150;900;94;24');
    expect(second).toContain('Davi Prado;mariana@email.com;Pendente;;');
  });

  it('tempo relativo do ultimo registro', () => {
    const ref = new Date('2026-11-19T12:00:00Z');
    expect(timeAgo('2026-11-19T11:59:40Z', ref)).toBe('agora');
    expect(timeAgo('2026-11-19T11:30:00Z', ref)).toBe('há 30 min');
    expect(timeAgo('2026-11-19T09:00:00Z', ref)).toBe('há 3 h');
    expect(timeAgo('2026-11-15T12:00:00Z', ref)).toBe('há 4 dias');
  });
});
