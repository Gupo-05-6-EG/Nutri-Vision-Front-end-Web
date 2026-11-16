import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DeviationAlertsPage } from '@/pages/DeviationAlertsPage';
import { fakeApi, json } from '@/test/fakeApi';
import type { DeviationAlert, DeviationAlertRule } from '@/types/deviationAlerts';

const defaultRule: DeviationAlertRule = {
  nutricionista_id: 10,
  percentual_desvio: 20,
  dias_consecutivos: 3,
  ativo: true,
};

const sampleAlert: DeviationAlert = {
  id: 5,
  nutricionista_id: 10,
  paciente_id: 7,
  paciente_nome: 'Alex Silva',
  paciente_email: 'alex@email.com',
  data_referencia: '2026-11-14',
  direcao: 'acima',
  dias_consecutivos: 3,
  percentual_limite: 20,
  percentual_medio_desvio: 30,
  meta_kcal: 2000,
  consumo_medio_kcal: 2600,
  lido: false,
  notificado_em: '2026-11-14T15:00:00Z',
  criado_em: '2026-11-14T15:00:00Z',
};

describe('DeviationAlertsPage', () => {
  it('exibe banner de notificacao, lista de alertas e permite marcar como lido', async () => {
    fakeApi({
      'GET /alertas-desvio/regra': () => json(defaultRule),
      'GET /alertas-desvio': () => json([sampleAlert]),
      'PATCH /alertas-desvio/5/lido': () => json({ ...sampleAlert, lido: true }),
    });

    render(<DeviationAlertsPage />);
    const user = userEvent.setup();

    expect(await screen.findByText('Alex Silva')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'você possui 1 alerta de desvio significativo de meta não lido.',
    );
    expect(screen.getByText('Acima da meta')).toBeInTheDocument();
    expect(screen.getByText('Novo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Marcar como lido' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Novo')).not.toBeInTheDocument();
  });

  it('valida campos e salva regra configuravel de desvio', async () => {
    const { calls } = fakeApi({
      'GET /alertas-desvio/regra': () => json(defaultRule),
      'GET /alertas-desvio': () => json([]),
      'PUT /alertas-desvio/regra': (req) => {
        const body = req.body as DeviationAlertRule;
        return json({
          nutricionista_id: 10,
          percentual_desvio: body.percentual_desvio,
          dias_consecutivos: body.dias_consecutivos,
          ativo: body.ativo,
        });
      },
    });

    render(<DeviationAlertsPage />);
    const user = userEvent.setup();

    const pctInput = await screen.findByLabelText('Limite de desvio (%)');
    const daysInput = screen.getByLabelText('Dias consecutivos');
    expect(pctInput).toHaveValue(20);
    expect(daysInput).toHaveValue(3);

    // Valor invalido bloqueia envio
    await user.clear(pctInput);
    await user.type(pctInput, '0');
    await user.click(screen.getByRole('button', { name: 'Salvar regra' }));
    expect(screen.getByText('Informe um percentual entre 1% e 100%.')).toBeInTheDocument();

    // Corrige para 15% por 4 dias e salva
    await user.clear(pctInput);
    await user.type(pctInput, '15');
    await user.clear(daysInput);
    await user.type(daysInput, '4');
    await user.click(screen.getByRole('button', { name: 'Salvar regra' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Regra atualizada: desvio >15% por 4 dia(s) consecutivo(s).',
    );
    const putCall = calls.find((c) => c.method === 'PUT' && c.path === '/alertas-desvio/regra');
    expect(putCall?.body).toEqual({
      percentual_desvio: 15,
      dias_consecutivos: 4,
      ativo: true,
    });
  });

  it('dispara verificacao manual de desvios e atualiza a lista', async () => {
    let processed = false;
    fakeApi({
      'GET /alertas-desvio/regra': () => json(defaultRule),
      'GET /alertas-desvio': () => json(processed ? [sampleAlert] : []),
      'POST /alertas-desvio/processar': () => {
        processed = true;
        return json({ data_referencia: '2026-11-14', alertas_gerados: 1 });
      },
    });

    render(<DeviationAlertsPage />);
    const user = userEvent.setup();

    expect(
      await screen.findByText(
        'Nenhum alerta de desvio significativo registrado para o filtro atual.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Verificar desvios agora' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Verificação concluída: 1 novo(s) alerta(s) gerado(s).',
    );
    expect(await screen.findByText('Alex Silva')).toBeInTheDocument();
  });
});
