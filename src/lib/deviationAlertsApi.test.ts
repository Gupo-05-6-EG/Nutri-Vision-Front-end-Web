import { describe, expect, it } from 'vitest';
import {
  formatDirectionLabel,
  getDeviationRule,
  listDeviationAlerts,
  markDeviationAlertAsRead,
  processDeviationAlerts,
  saveDeviationRule,
  validateDeviationRule,
} from '@/lib/deviationAlertsApi';
import { fakeApi, json } from '@/test/fakeApi';

const regra = { nutricionista_id: 10, percentual_desvio: 15, dias_consecutivos: 3, ativo: true };

describe('cliente de alertas de desvio', () => {
  it('lê e salva a regra', async () => {
    const { calls } = fakeApi({
      'GET /alertas-desvio/regra': () => json(regra),
      'PUT /alertas-desvio/regra': (call) =>
        json({ nutricionista_id: 10, ...(call.body as object) }),
    });
    await expect(getDeviationRule()).resolves.toEqual(regra);
    const nova = { percentual_desvio: 20, dias_consecutivos: 2, ativo: false };
    await expect(saveDeviationRule(nova)).resolves.toEqual({ nutricionista_id: 10, ...nova });
    expect(calls[1].body).toEqual(nova);
  });

  it.each([
    [undefined, '/alertas-desvio'],
    [{ unreadOnly: true }, '/alertas-desvio?apenas_nao_lidos=true'],
    [{ patientId: 7 }, '/alertas-desvio?paciente_id=7'],
    [{ patientId: 7, unreadOnly: true }, '/alertas-desvio?paciente_id=7&apenas_nao_lidos=true'],
  ])('lista com o filtro %j em %s', async (filtro, caminho) => {
    const { calls } = fakeApi({ 'GET /alertas-desvio': () => json([]) });
    await expect(listDeviationAlerts(filtro)).resolves.toEqual([]);
    expect(calls[0].path).toBe(caminho);
  });

  it('processa e marca como lido', async () => {
    const { calls } = fakeApi({
      'POST /alertas-desvio/processar': () =>
        json({ data_referencia: '2026-11-16', alertas_gerados: 2 }),
      'PATCH /alertas-desvio/5/lido': () => json({ id: 5, lido: true }),
    });
    await expect(processDeviationAlerts()).resolves.toEqual({
      data_referencia: '2026-11-16',
      alertas_gerados: 2,
    });
    await expect(markDeviationAlertAsRead(5)).resolves.toMatchObject({ id: 5, lido: true });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /alertas-desvio/processar',
      'PATCH /alertas-desvio/5/lido',
    ]);
  });
});

describe('formatDirectionLabel', () => {
  it.each([
    ['acima', 'Acima da meta'],
    ['abaixo', 'Abaixo da meta'],
    ['ambos', 'Oscilação acima/abaixo'],
  ] as const)('%s -> %s', (direcao, rotulo) => {
    expect(formatDirectionLabel(direcao)).toBe(rotulo);
  });
});

describe('validateDeviationRule', () => {
  it.each([
    ['15', '3', 15, 3],
    ['12,5', '1', 12.5, 1],
    [' 100 ', '30', 100, 30],
  ])('aceita %j%% por %j dias', (pct, dias, p, d) => {
    expect(validateDeviationRule(pct, dias)).toEqual({ parsed: { percent: p, days: d } });
  });

  it.each(['0', '-5', '100,1', 'abc', ''])('recusa o percentual %j', (pct) => {
    expect(validateDeviationRule(pct, '3')).toEqual({
      percent: 'Informe um percentual entre 1% e 100%.',
    });
  });

  it.each(['0', '31', '2,5', 'x'])('recusa %j dias', (dias) => {
    expect(validateDeviationRule('15', dias)).toEqual({
      days: 'Informe entre 1 e 30 dias consecutivos.',
    });
  });

  it('devolve os dois erros juntos', () => {
    expect(Object.keys(validateDeviationRule('0', '0')).sort()).toEqual(['days', 'percent']);
  });
});
