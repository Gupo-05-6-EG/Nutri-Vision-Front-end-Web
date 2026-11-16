import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatShortDate, hasConsecutiveInactivity, lastSevenDays } from '@/lib/dashboard';
import { hasAbandonmentAlert } from '@/lib/linksApi';
import { DashboardPage } from '@/pages/DashboardPage';
import { detail, fakeApi, json } from '@/test/fakeApi';

const REF_DATE = new Date('2026-11-11T12:00:00Z');

const alex = {
  paciente_id: 7,
  nome: 'Alex Silva',
  email: 'alex@email.com',
  status: 'ativo',
  streak: 4,
  dias_streak_zero: 0,
};

const biaAbandono = {
  paciente_id: 8,
  nome: 'Bia Souza',
  email: 'bia@email.com',
  status: 'ativo',
  streak: 0,
  dias_streak_zero: 3,
};

const planoAtivo = {
  id: 1,
  paciente_id: 7,
  nutricionista_id: 10,
  titulo: 'Reeducação alimentar',
  observacao: null,
  ativo: true,
  criado_em: '2026-11-01T12:00:00Z',
  refeicoes: [],
  totais: { meta_kcal: 2000, meta_proteinas_g: 120 },
};

describe('regras do dashboard e alertas de abandono', () => {
  it('lastSevenDays gera os 7 dias anteriores ate a referencia em ordem cronologica', () => {
    const days = lastSevenDays(REF_DATE);
    expect(days).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ]);
    expect(formatShortDate('2026-11-05')).toBe('05/11');
    expect(formatShortDate('invalida')).toBe('invalida');
  });

  it('hasAbandonmentAlert exige streak == 0 por pelo menos 3 dias consecutivos', () => {
    expect(
      hasAbandonmentAlert({
        id: 1,
        name: 'A',
        email: 'a@a.com',
        status: 'ativo',
        linkedAt: null,
        streak: 0,
        zeroStreakDays: 3,
      }),
    ).toBe(true);

    expect(
      hasAbandonmentAlert({
        id: 1,
        name: 'A',
        email: 'a@a.com',
        status: 'ativo',
        linkedAt: null,
        streak: 0,
        zeroStreakDays: 2,
      }),
    ).toBe(false);

    expect(
      hasAbandonmentAlert({
        id: 1,
        name: 'A',
        email: 'a@a.com',
        status: 'ativo',
        linkedAt: null,
        streak: 2,
        zeroStreakDays: 4,
      }),
    ).toBe(false);

    expect(
      hasAbandonmentAlert({
        id: 1,
        name: 'A',
        email: 'a@a.com',
        status: 'ativo',
        linkedAt: null,
        abandonmentAlert: true,
      }),
    ).toBe(true);
  });

  it('hasConsecutiveInactivity detecta 3 dias seguidos sem registro no final da janela', () => {
    const base = [
      { date: '2026-11-08', label: '08/11', consumedKcal: 1900, goalKcal: 2000, mealCount: 3 },
      { date: '2026-11-09', label: '09/11', consumedKcal: 0, goalKcal: 2000, mealCount: 0 },
      { date: '2026-11-10', label: '10/11', consumedKcal: 0, goalKcal: 2000, mealCount: 0 },
      { date: '2026-11-11', label: '11/11', consumedKcal: 0, goalKcal: 2000, mealCount: 0 },
    ];
    expect(hasConsecutiveInactivity(base, 3)).toBe(true);
    expect(hasConsecutiveInactivity(base.slice(0, 2), 3)).toBe(false);
  });
});

describe('DashboardPage', () => {
  it('carrega plano ativo e consumo de 7 dias, exibindo grafico e metricas', async () => {
    fakeApi({
      'GET /patients': () => json([alex, biaAbandono]),
      'GET /pacientes/7/planos/ativo': () => json(planoAtivo),
      'GET /refeicoes/consumo-diario': (call) => {
        const isLastDay = call.path.includes('data=2026-11-11');
        return json({
          paciente_id: 7,
          data: '2026-11-11',
          quantidade_refeicoes: isLastDay ? 4 : 3,
          totais: { calorias_kcal: isLastDay ? 2050 : 1950 },
        });
      },
    });

    render(<DashboardPage referenceDate={REF_DATE} />);

    expect(await screen.findByText('Reeducação alimentar')).toBeInTheDocument();
    expect(screen.getByText('2.000 kcal')).toBeInTheDocument();
    expect(screen.getByText('7 de 7 dias')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Gráfico de 7 dias comparando meta calórica e consumo real',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('05/11')).toBeInTheDocument();
    expect(screen.getByText('11/11')).toBeInTheDocument();
  });

  it('exibe alerta vermelho quando o paciente selecionado tem streak == 0 por 3 dias seguidos', async () => {
    fakeApi({
      'GET /patients': () => json([alex, biaAbandono]),
      'GET /pacientes/7/planos/ativo': () => json(planoAtivo),
      'GET /pacientes/8/planos/ativo': () => detail('Paciente sem plano ativo', 404),
      'GET /refeicoes/consumo-diario': () =>
        json({
          paciente_id: 8,
          data: '2026-11-11',
          quantidade_refeicoes: 0,
          totais: { calorias_kcal: 0 },
        }),
    });

    render(<DashboardPage referenceDate={REF_DATE} />);
    await screen.findByText('Reeducação alimentar');

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Paciente'), '8');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Alerta de abandono do plano:');
    expect(alert).toHaveTextContent('Bia Souza');
    expect(screen.getByText('Sem plano prescrito')).toBeInTheDocument();
    expect(screen.getByText('Não definida')).toBeInTheDocument();
  });

  it('mostra mensagem quando nao ha pacientes vinculados', async () => {
    fakeApi({ 'GET /patients': () => json([]) });
    render(<DashboardPage referenceDate={REF_DATE} />);

    expect(
      await screen.findByText('Nenhum paciente vinculado para visualizar o dashboard.'),
    ).toBeInTheDocument();
  });

  it('mostra erro se a API falhar ao carregar o consumo', async () => {
    fakeApi({
      'GET /patients': () => json([alex]),
      'GET /pacientes/7/planos/ativo': () => json(planoAtivo),
      'GET /refeicoes/consumo-diario': () => detail('Erro ao consultar consumo', 500),
    });

    render(<DashboardPage referenceDate={REF_DATE} />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Erro ao consultar consumo'),
    );
  });
});
