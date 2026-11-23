import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MonitoredPatient } from '@/lib/portfolioApi';
import { PatientsHubPage } from '@/pages/PatientsHubPage';
import { detail, fakeApi, json } from '@/test/fakeApi';

const alex: MonitoredPatient = {
  paciente_id: 7,
  nome: 'Alex Silva',
  email: 'alex@email.com',
  status_vinculo: 'ativo',
  vinculado_em: '2025-02-12T10:00:00Z',
  situacao: 'ativo',
  motivo_risco: null,
  meta_kcal: 2000,
  consumo_hoje_kcal: 1680,
  adesao_semanal_pct: 85,
  ofensiva: 14,
  xp: 520,
  alertas_nao_lidos: 0,
  ultimo_registro: { tipo: 'almoco', em: '2026-11-19T15:00:00Z' },
};

const davi: MonitoredPatient = {
  ...alex,
  paciente_id: 9,
  nome: 'Davi Prado',
  email: 'davi@email.com',
  situacao: 'pendente',
  meta_kcal: null,
  adesao_semanal_pct: null,
};

const overview = (pacientes: MonitoredPatient[]) =>
  json({
    indicadores: {},
    contagens: { todos: 2, ativos: 1, em_risco: 0, pendentes: 1 },
    total: pacientes.length,
    pagina: 1,
    por_pagina: 100,
    pacientes,
  });

const profile = {
  paciente_id: 7,
  nome: 'Alex Silva',
  email: 'alex@email.com',
  membro_desde: '2025-02-12T10:00:00Z',
  idade: 27,
  genero: 'masculino',
  peso_kg: 78.4,
  altura_cm: 178,
  imc: 24.7,
  classificacao_imc: 'Eutrófico',
  tmb_kcal: 1820,
  nivel_atividade: 'moderado',
  fator_atividade: 1.55,
  meta: { kcal: 2000, proteinas_g: 130, carboidratos_g: 210, gorduras_g: 55, origem: 'plano' },
  gamificacao: { xp: 520, ofensiva: 14, divisao: 'Ouro', refeicoes_registradas: 36 },
  plano_ativo: { id: 3, titulo: 'Hipertrofia Limpa', versao: 2 },
};

function routes(extra: Record<string, () => Response> = {}) {
  return fakeApi({
    'GET /nutricionista/visao-geral': () => overview([alex, davi]),
    'GET /pacientes/7/perfil': () => json(profile),
    'GET /refeicoes/consumo-diario': () =>
      json({
        paciente_id: 7,
        data: '2026-11-19',
        quantidade_refeicoes: 3,
        totais: { calorias_kcal: 1680, proteinas_g: 110, carboidratos_g: 180, gorduras_g: 48 },
      }),
    'GET /patients': () =>
      json([{ paciente_id: 7, nome: 'Alex Silva', email: 'alex@email.com', status: 'ativo' }]),
    'GET /pacientes/7/planos/ativo': () => detail('Paciente sem plano ativo', 404),
    ...extra,
  });
}

function renderHub(selectedId: number | null, handlers: Partial<Record<string, () => void>> = {}) {
  const onSelect = vi.fn();
  const onPrescribe = vi.fn();
  render(
    <PatientsHubPage
      selectedId={selectedId}
      onSelect={onSelect}
      onPrescribe={onPrescribe}
      onGenerateCode={handlers.onGenerateCode ?? (() => {})}
    />,
  );
  return { onSelect, onPrescribe };
}

describe('PatientsHubPage', () => {
  it('lista com filtros e contagens, e escolhe o paciente', async () => {
    const { calls } = routes();
    const { onSelect } = renderHub(null);

    expect(await screen.findByRole('button', { name: /Alex Silva/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pendentes\s*1/ })).toBeInTheDocument();
    expect(screen.getByText('Escolha um paciente para ver a ficha.')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Pendentes/ }));
    expect(calls.at(-1)?.path).toContain('status=pendentes');

    await user.click(screen.getByRole('button', { name: /Alex Silva/ }));
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it('ficha mostra triagem, planejado x consumido e da o incentivo', async () => {
    const { calls } = routes({
      'POST /pacientes/7/incentivo': () =>
        json({ paciente_id: 7, xp_concedido: 10, xp_total: 530 }),
    });
    const { onPrescribe } = renderHub(7);

    expect(await screen.findByText('78,4 kg')).toBeInTheDocument();
    expect(screen.getByText('1,78 m')).toBeInTheDocument();
    expect(screen.getByText('Eutrófico')).toBeInTheDocument();
    expect(screen.getByText('1.820 kcal')).toBeInTheDocument();
    expect(screen.getByText('Moderado')).toBeInTheDocument();
    expect(screen.getByText(/Hipertrofia Limpa \(v2\)/)).toBeInTheDocument();
    expect(screen.getByText('84%')).toBeInTheDocument();
    expect(screen.getByText('Faltam 320 kcal')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Incentivo (+10 XP)' }));
    expect(await screen.findByText('+10 XP enviados para Alex Silva.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/pacientes/7/incentivo')).toBe(
      true,
    );

    await user.click(screen.getByRole('button', { name: 'Ajustar Prescrição' }));
    expect(onPrescribe).toHaveBeenCalledWith(7);
  });

  it('incentivo repetido no dia avisa', async () => {
    routes({ 'POST /pacientes/7/incentivo': () => detail('ja recebeu', 409) });
    renderHub(7);

    await screen.findByText('78,4 kg');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Incentivo (+10 XP)' }));

    expect(await screen.findByText('Alex Silva já recebeu o incentivo hoje.')).toBeInTheDocument();
  });

  it('paciente pendente nao mostra dados de saude', async () => {
    const { calls } = routes();
    renderHub(9);

    expect(await screen.findByText(/ainda precisa aceitar o vínculo/)).toBeInTheDocument();
    expect(calls.some((c) => c.path.startsWith('/pacientes/9/perfil'))).toBe(false);
  });

  it('desvincula depois de confirmar', async () => {
    const { calls } = routes({
      'DELETE /patients/7': () =>
        json({ vinculo_id: 1, paciente_id: 7, nutricionista_id: 10, status: 'encerrado' }),
    });
    const { onSelect } = renderHub(7);
    await screen.findByText('78,4 kg');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Desvincular paciente' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/patients/7')).toBe(true);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('gerar codigo de vinculo', async () => {
    routes();
    const onGenerateCode = vi.fn();
    renderHub(null, { onGenerateCode });

    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Gerar Código de Vínculo' }));
    expect(onGenerateCode).toHaveBeenCalled();
  });
});
