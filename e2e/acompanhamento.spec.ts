import { type Page, type Route, expect, test } from '@playwright/test';

/**
 * Fluxo de acompanhamento do nutricionista (Task 7.4, parte 4/4): login ->
 * Pacientes & Vínculos -> ficha do paciente com o dashboard de 7 dias (meta x
 * consumo e alerta de abandono, Task 5.2) -> Alertas de Desvio (regra,
 * verificação e leitura, Task 5.4). A API é simulada com estado em `http://api.test`.
 */

const API = 'http://api.test/api/v1';
const META_KCAL = 2000;

/** As 7 datas da janela do dashboard (UTC), da mais antiga para hoje. */
function janela(): string[] {
  const hoje = new Date();
  const fim = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  return Array.from({ length: 7 }, (_, i) =>
    new Date(fim - (6 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

// Consumo de Bia nos 4 primeiros dias; nos 3 últimos ela não registrou nada.
const CONSUMO_BIA = [1950, 2400, 1500, 2100, 0, 0, 0];

interface MockState {
  consultas: { paciente: number; data: string }[];
  regraSalva: unknown[];
  lidos: number[];
  processado: boolean;
}

function alerta(id: number, extra: Record<string, unknown>) {
  return {
    id,
    nutricionista_id: 10,
    data_referencia: janela()[6],
    dias_consecutivos: 3,
    percentual_limite: 15,
    meta_kcal: META_KCAL,
    lido: false,
    notificado_em: null,
    criado_em: new Date().toISOString(),
    ...extra,
  };
}

async function mockApi(page: Page): Promise<MockState> {
  const state: MockState = { consultas: [], regraSalva: [], lidos: [], processado: false };
  let regra = { nutricionista_id: 10, percentual_desvio: 15, dias_consecutivos: 3, ativo: true };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
      body: JSON.stringify(body),
    });

  const alertas = () => {
    const lista = [
      alerta(1, {
        paciente_id: 7,
        paciente_nome: 'Alex Silva',
        paciente_email: 'alex@email.com',
        direcao: 'acima',
        percentual_medio_desvio: 22.5,
        consumo_medio_kcal: 2450,
      }),
    ];
    if (state.processado) {
      lista.push(
        alerta(2, {
          paciente_id: 8,
          paciente_nome: 'Bia Souza',
          paciente_email: 'bia@email.com',
          direcao: 'abaixo',
          percentual_medio_desvio: 100,
          consumo_medio_kcal: 0,
        }),
      );
    }
    return lista.map((a) => ({ ...a, lido: state.lidos.includes(a.id) }));
  };

  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    if (method === 'OPTIONS') return reply(route, {});

    if (path === '/health') {
      return reply(route, { status: 'ok', service: 'nutri-vision-api', environment: 'e2e' });
    }
    if (path === '/linking-code' && method === 'POST') {
      return reply(route, {
        codigo: '123456',
        status: 'ativo',
        expira_em: new Date(Date.now() + 30 * 60_000).toISOString(),
      });
    }
    if (path === '/auth/login') {
      return reply(route, {
        access_token: 'token-e2e',
        token_type: 'bearer',
        expira_em: new Date(Date.now() + 86_400_000).toISOString(),
        usuario: { id: 10, nome: 'Dra. Ana', email: 'ana@exemplo.com', perfil: 'nutricionista' },
      });
    }
    if (path === '/auth/me') {
      return reply(route, {
        id: 10,
        nome: 'Dra. Ana',
        email: 'ana@exemplo.com',
        perfil: 'nutricionista',
        crn: 'CRN-3 12345',
      });
    }
    if (path === '/nutricionista/visao-geral') {
      const monitorado = (id: number, nome: string, email: string, ofensiva: number) => ({
        paciente_id: id,
        nome,
        email,
        status_vinculo: 'ativo',
        vinculado_em: '2026-10-01T10:00:00Z',
        situacao: id === 8 ? 'em_risco' : 'ativo',
        motivo_risco: id === 8 ? 'sem_registro' : null,
        meta_kcal: META_KCAL,
        consumo_hoje_kcal: id === 8 ? 0 : 2000,
        adesao_semanal_pct: id === 8 ? 28.6 : 100,
        ofensiva,
        xp: 100,
        alertas_nao_lidos: 0,
        ultimo_registro: null,
      });
      const pendentes = url.searchParams.get('status') === 'pendentes';
      return reply(route, {
        indicadores: {
          pacientes_ativos: 2,
          pacientes_pendentes: 0,
          alertas_criticos: 1,
          adesao_media_pct: 64.3,
          ofensiva_media_dias: 6,
        },
        contagens: { todos: 2, ativos: 2, em_risco: 1, pendentes: 0 },
        total: pendentes ? 0 : 2,
        pagina: 1,
        por_pagina: 100,
        pacientes: pendentes
          ? []
          : [
              monitorado(7, 'Alex Silva', 'alex@email.com', 12),
              monitorado(8, 'Bia Souza', 'bia@email.com', 0),
            ],
      });
    }
    const perfil = path.match(/^\/pacientes\/(\d+)\/perfil$/);
    if (perfil) {
      return reply(route, {
        paciente_id: Number(perfil[1]),
        nome: perfil[1] === '8' ? 'Bia Souza' : 'Alex Silva',
        email: 'x@email.com',
        membro_desde: '2026-10-01T10:00:00Z',
        idade: 30,
        genero: 'feminino',
        peso_kg: 64.5,
        altura_cm: 165,
        imc: 23.7,
        classificacao_imc: 'Eutrófico',
        tmb_kcal: 1442,
        nivel_atividade: 'moderado',
        fator_atividade: 1.55,
        meta: {
          kcal: META_KCAL,
          proteinas_g: 90,
          carboidratos_g: 250,
          gorduras_g: 66.7,
          origem: 'plano',
        },
        gamificacao: { xp: 100, ofensiva: 0, divisao: 'Bronze', refeicoes_registradas: 10 },
        plano_ativo: null,
      });
    }
    if (path === '/patients') {
      return reply(route, [
        {
          paciente_id: 7,
          nome: 'Alex Silva',
          email: 'alex@email.com',
          status: 'ativo',
          streak: 12,
        },
        {
          paciente_id: 8,
          nome: 'Bia Souza',
          email: 'bia@email.com',
          status: 'ativo',
          streak: 0,
          dias_streak_zero: 3,
        },
      ]);
    }
    const plano = path.match(/^\/pacientes\/(\d+)\/planos\/ativo$/);
    if (plano) {
      return reply(route, {
        id: Number(plano[1]) * 10,
        paciente_id: Number(plano[1]),
        nutricionista_id: 10,
        titulo: plano[1] === '8' ? 'Reeducação - fase 2' : 'Manutenção',
        observacao: null,
        ativo: true,
        criado_em: new Date().toISOString(),
        refeicoes: [],
        totais: { meta_kcal: META_KCAL, meta_proteinas_g: 90 },
      });
    }
    if (path === '/refeicoes/consumo-diario') {
      const paciente = Number(url.searchParams.get('paciente_id'));
      const data = url.searchParams.get('data') ?? '';
      state.consultas.push({ paciente, data });
      const kcal = paciente === 8 ? (CONSUMO_BIA[janela().indexOf(data)] ?? 0) : 2000;
      return reply(route, {
        paciente_id: paciente,
        data,
        quantidade_refeicoes: kcal > 0 ? 4 : 0,
        totais: { calorias_kcal: kcal },
      });
    }
    if (path === '/alertas-desvio/regra') {
      if (method === 'PUT') {
        const body = request.postDataJSON();
        state.regraSalva.push(body);
        regra = { nutricionista_id: 10, ...body };
      }
      return reply(route, regra);
    }
    if (path === '/alertas-desvio/processar' && method === 'POST') {
      state.processado = true;
      return reply(route, { data_referencia: janela()[6], alertas_gerados: 1 });
    }
    if (path === '/alertas-desvio') {
      const soNaoLidos = url.searchParams.get('apenas_nao_lidos') === 'true';
      return reply(
        route,
        alertas().filter((a) => !soNaoLidos || !a.lido),
      );
    }
    const lido = path.match(/^\/alertas-desvio\/(\d+)\/lido$/);
    if (lido && method === 'PATCH') {
      state.lidos.push(Number(lido[1]));
      return reply(
        route,
        alertas().find((a) => a.id === Number(lido[1])),
      );
    }
    return reply(route, { detail: `Sem mock para ${method} ${path}` }, 404);
  });
  return state;
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('E-mail profissional').fill('ana@exemplo.com');
  await page.getByLabel('Senha de acesso').fill('senha-forte-123');
  await page.getByRole('button', { name: 'Entrar no painel clínico' }).click();
  await expect(page.getByText('Bia Souza')).toBeVisible();
}

const menu = (page: Page) => page.getByRole('navigation', { name: 'Menu do painel' });
const cartao = (page: Page, nome: string) =>
  page.locator('.patient-card').filter({ hasText: nome });
const abandono = (page: Page) => page.getByRole('alert').filter({ hasText: 'Alerta de abandono' });
const tabelaDias = (page: Page) =>
  page.getByRole('table', { name: 'Tabela de consumo dos últimos 7 dias' });
const metrica = (page: Page, nome: string) =>
  page.locator('.dashboard__metric').filter({ hasText: nome }).locator('strong');

test('dashboard de 7 dias destaca o paciente em abandono', async ({ page }) => {
  const api = await mockApi(page);
  await login(page);

  // 1. "Ver Ficha" da Bia na Visao Geral abre a ficha dela em Pacientes & Vinculos
  await page.getByRole('button', { name: 'Ver ficha de Bia Souza' }).click();
  await expect(page).toHaveURL(/#\/pacientes\?id=8$/);
  await expect(cartao(page, 'Bia Souza')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: /Bia Souza/ })).toBeVisible();

  // 2. Alerta vermelho de abandono (streak zerado há 3 dias)
  await expect(abandono(page)).toContainText('Bia Souza está com ofensiva zerada');

  // 3. Resumo e tabela da janela de 7 dias, com o consumo de cada dia
  await expect(metrica(page, 'Plano ativo')).toHaveText('Reeducação - fase 2');
  await expect(metrica(page, 'Meta calórica diária')).toHaveText('2.000 kcal');
  await expect(metrica(page, 'Média consumida (7d)')).toHaveText('1.136 kcal');
  // Dentro de ±15% da meta: 1.950 e 2.100 (2.400 e 1.500 ficam fora)
  await expect(metrica(page, 'Dias dentro da meta')).toHaveText('2 de 7 dias');

  const linhas = tabelaDias(page).getByRole('row');
  await expect(linhas).toHaveCount(8);
  const datas = janela();
  for (let i = 0; i < 7; i++) {
    const [, mes, dia] = datas[i].split('-');
    const kcal = CONSUMO_BIA[i].toLocaleString('pt-BR');
    await expect(linhas.nth(i + 1)).toHaveText(
      `${dia}/${mes}2.000${kcal}${CONSUMO_BIA[i] > 0 ? 4 : 0}`,
    );
  }
  await expect(page.getByRole('img', { name: /Gráfico de 7 dias/ })).toBeVisible();
  expect(api.consultas.filter((c) => c.paciente === 8).map((c) => c.data)).toEqual(
    expect.arrayContaining(datas),
  );

  // 4. Trocar para um paciente em dia remove o alerta
  await cartao(page, 'Alex Silva').click();
  await expect(metrica(page, 'Plano ativo')).toHaveText('Manutenção');
  await expect(metrica(page, 'Dias dentro da meta')).toHaveText('7 de 7 dias');
  await expect(abandono(page)).toBeHidden();
});

test('nutricionista ajusta a regra, verifica e lê os alertas de desvio', async ({ page }) => {
  const api = await mockApi(page);
  await login(page);
  await menu(page).getByRole('link', { name: 'Alertas de Desvio' }).click();

  // 1. Um alerta não lido já existe: aviso no topo e item marcado como novo
  const aviso = page.locator('.deviation-banner');
  await expect(aviso).toHaveText(/1 alerta de desvio significativo de meta não lido/);
  const itemAlex = page.getByRole('listitem').filter({ hasText: 'Alex Silva' });
  await expect(itemAlex).toContainText('Acima da meta');
  await expect(itemAlex).toContainText('2.450 kcal');
  await expect(page.getByLabel('Limite de desvio (%)')).toHaveValue('15');

  // 2. Regra inválida não é enviada; a válida é salva
  await page.getByLabel('Limite de desvio (%)').fill('150');
  await page.getByRole('button', { name: 'Salvar regra' }).click();
  await expect(page.getByText('Informe um percentual entre 1% e 100%.')).toBeVisible();
  expect(api.regraSalva).toEqual([]);

  await page.getByLabel('Limite de desvio (%)').fill('20');
  await page.getByLabel('Dias consecutivos').fill('2');
  await page.getByRole('button', { name: 'Salvar regra' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Regra atualizada: desvio >20% por 2 dia(s) consecutivo(s).',
  );
  expect(api.regraSalva).toEqual([{ percentual_desvio: 20, dias_consecutivos: 2, ativo: true }]);

  // 3. Verificar agora gera o alerta da Bia (abaixo da meta)
  await page.getByRole('button', { name: 'Verificar desvios agora' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Verificação concluída: 1 novo(s) alerta(s) gerado(s).',
  );
  await expect(page.getByRole('listitem').filter({ hasText: 'Bia Souza' })).toContainText(
    'Abaixo da meta',
  );
  await expect(aviso).toHaveText(/2 alertas de desvio significativo de meta não lidos/);

  // 4. Marcar como lido e filtrar só os não lidos
  await itemAlex.getByRole('button', { name: 'Marcar como lido' }).click();
  await expect(itemAlex.getByRole('button', { name: 'Marcar como lido' })).toBeHidden();
  await expect(aviso).toHaveText(/1 alerta de desvio significativo de meta não lido/);
  expect(api.lidos).toEqual([1]);

  await page.getByLabel('Apenas não lidos').check();
  await expect(page.getByRole('listitem').filter({ hasText: 'Alex Silva' })).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ hasText: 'Bia Souza' })).toBeVisible();
});
