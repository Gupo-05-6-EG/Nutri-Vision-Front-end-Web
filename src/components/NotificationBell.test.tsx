import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NotificationBell } from '@/components/NotificationBell';
import { fakeApi, json } from '@/test/fakeApi';

const alert = {
  id: 5,
  nutricionista_id: 10,
  paciente_id: 7,
  paciente_nome: 'Alex Silva',
  paciente_email: 'alex@email.com',
  data_referencia: '2026-11-18',
  direcao: 'abaixo',
  dias_consecutivos: 2,
  percentual_limite: 20,
  percentual_medio_desvio: 73.7,
  meta_kcal: 1000,
  consumo_medio_kcal: 263,
  lido: false,
  notificado_em: null,
  criado_em: '2026-11-19T03:00:00Z',
};

const pendingOverview = {
  indicadores: {},
  contagens: { todos: 1, ativos: 0, em_risco: 0, pendentes: 1 },
  total: 1,
  pagina: 1,
  por_pagina: 20,
  pacientes: [
    { paciente_id: 9, nome: 'Davi Prado', email: 'davi@email.com', situacao: 'pendente' },
  ],
};

describe('NotificationBell', () => {
  it('conta alertas nao lidos e vinculos pendentes e leva ao paciente', async () => {
    const { calls } = fakeApi({
      'GET /alertas-desvio': () => json([alert]),
      'GET /nutricionista/visao-geral': () => json(pendingOverview),
      'PATCH /alertas-desvio/5/lido': () => json({ ...alert, lido: true }),
    });
    const onOpen = vi.fn();
    render(<NotificationBell onOpenPatient={onOpen} />);

    const button = await screen.findByRole('button', { name: 'Notificações: 2 novas' });
    expect(calls.some((c) => c.path === '/alertas-desvio?apenas_nao_lidos=true')).toBe(true);
    const user = userEvent.setup();
    await user.click(button);

    expect(screen.getByText(/desvio médio de 74% por 2 dias/)).toBeInTheDocument();
    expect(
      screen.getByText('Resgatou o seu código e ainda não aceitou o vínculo.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Marcar alerta de Alex Silva como lido' }));
    expect(calls.some((c) => c.method === 'PATCH')).toBe(true);
    expect(
      await screen.findByRole('button', { name: 'Notificações: 1 novas' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Davi Prado/ }));
    expect(onOpen).toHaveBeenCalledWith(9);
  });

  it('sem nada novo', async () => {
    fakeApi({
      'GET /alertas-desvio': () => json([]),
      'GET /nutricionista/visao-geral': () => json({ ...pendingOverview, pacientes: [] }),
    });
    render(<NotificationBell onOpenPatient={() => {}} />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Notificações' }));
    expect(screen.getByText('Nada novo por aqui.')).toBeInTheDocument();
  });
});
