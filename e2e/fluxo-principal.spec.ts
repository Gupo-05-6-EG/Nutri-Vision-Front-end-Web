import { type Page, type Route, expect, test } from '@playwright/test';

/**
 * Fluxo principal do nutricionista no painel: login -> pacientes vinculados ->
 * aba do construtor de planos (busca na TACO, metas, blocos) -> prescrever para
 * o paciente -> reabrir o plano ativo. A API e simulada com estado em
 * `http://api.test`.
 */

const API = 'http://api.test/api/v1';

const TACO = [
  {
    id: 3,
    nome: 'Arroz, tipo 1, cozido',
    categoria: 'Cereais',
    kcal_100g: 128,
    carbs_100g: 28.1,
    prot_100g: 2.5,
    gord_100g: 0.2,
  },
  {
    id: 411,
    nome: 'Frango, peito, sem pele, grelhado',
    categoria: 'Carnes',
    kcal_100g: 159,
    carbs_100g: 0,
    prot_100g: 32,
    gord_100g: 2.5,
  },
  {
    id: 556,
    nome: 'Feijão, carioca, cozido',
    categoria: 'Leguminosas',
    kcal_100g: 76,
    carbs_100g: 13.6,
    prot_100g: 4.8,
    gord_100g: 0.5,
  },
];

interface MockState {
  activePlan: Record<string, unknown> | null;
  posted: unknown[];
  authHeaders: (string | null)[];
}

async function mockApi(page: Page): Promise<MockState> {
  const state: MockState = { activePlan: null, posted: [], authHeaders: [] };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
      body: JSON.stringify(body),
    });

  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    if (request.method() === 'OPTIONS') return reply(route, {});
    if (path !== '/health' && path !== '/auth/login') {
      state.authHeaders.push(request.headers()['authorization'] ?? null);
    }

    if (path === '/health') {
      return reply(route, { status: 'ok', service: 'nutri-vision-api', environment: 'e2e' });
    }
    if (path === '/linking-code' && request.method() === 'POST') {
      return reply(route, {
        codigo: '123456',
        status: 'ativo',
        expira_em: new Date(Date.now() + 30 * 60_000).toISOString(),
      });
    }
    if (path === '/auth/login') {
      const { email, senha } = request.postDataJSON();
      if (email !== 'ana@exemplo.com' || senha !== 'senha-forte-123') {
        return reply(route, { detail: 'Email ou senha invalidos' }, 401);
      }
      return reply(route, {
        access_token: 'token-e2e',
        token_type: 'bearer',
        expira_em: new Date(Date.now() + 86_400_000).toISOString(),
        usuario: { id: 10, nome: 'Dra. Ana', email, perfil: 'nutricionista', crn: 'CRN-3 12345' },
      });
    }
    if (path === '/patients') {
      return reply(route, [
        { paciente_id: 7, nome: 'Alex Silva', email: 'alex@email.com', status: 'ativo' },
      ]);
    }
    if (path === '/alimentos-taco') {
      const nome = (url.searchParams.get('nome') ?? '').toLowerCase();
      return reply(
        route,
        TACO.filter((f) => f.nome.toLowerCase().includes(nome)),
      );
    }
    if (path === '/pacientes/7/planos/ativo') {
      return state.activePlan
        ? reply(route, state.activePlan)
        : reply(route, { detail: 'Paciente sem plano ativo' }, 404);
    }
    if (path === '/pacientes/7/planos' && request.method() === 'POST') {
      const body = request.postDataJSON();
      state.posted.push(body);
      const refeicoes = body.refeicoes.map((r: Record<string, unknown>, i: number) => ({
        id: i + 1,
        ...r,
        horario: r.horario ? `${r.horario}:00` : null,
        alimentos: (r.alimentos as object[]).map((a, j) => ({ id: j + 1, ...a })),
      }));
      state.activePlan = {
        id: state.posted.length,
        paciente_id: 7,
        nutricionista_id: 10,
        titulo: body.titulo,
        observacao: body.observacao,
        ativo: true,
        criado_em: new Date().toISOString(),
        refeicoes,
        totais: {
          meta_kcal: refeicoes.reduce((t: number, r: { meta_kcal: number }) => t + r.meta_kcal, 0),
          meta_proteinas_g: refeicoes.reduce(
            (t: number, r: { meta_proteinas_g: number }) => t + r.meta_proteinas_g,
            0,
          ),
        },
      };
      return reply(route, state.activePlan, 201);
    }
    return reply(route, { detail: `Sem mock para ${request.method()} ${path}` }, 404);
  });
  return state;
}

async function login(page: Page, senha = 'senha-forte-123') {
  await page.goto('/');
  await page.getByLabel('E-mail profissional').fill('ana@exemplo.com');
  await page.getByLabel('Senha de acesso').fill(senha);
  await page.getByRole('button', { name: 'Entrar no painel clínico' }).click();
}

const loginHeading = (page: Page) => page.getByRole('heading', { name: 'Bem-vindo de volta' });

async function pickFood(page: Page, block: number, term: string, option: RegExp, grams: string) {
  const meal = page.getByRole('group', { name: `Refeição ${block}` });
  const input = meal.getByRole('combobox', { name: 'Alimento' }).last();
  await input.fill(term);
  await meal.getByRole('option', { name: option }).click();
  await meal.getByLabel('Quantidade em gramas').last().fill(grams);
}

test('login com senha errada mostra o erro e nao entra', async ({ page }) => {
  await mockApi(page);
  await login(page, 'errada');

  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
  await expect(loginHeading(page)).toBeVisible();
});

test('nutricionista monta, prescreve e reabre o plano do paciente', async ({ page }) => {
  const api = await mockApi(page);

  // 1. Login: abre na aba de pacientes vinculados
  await login(page);
  await expect(page.getByText('Alex Silva')).toBeVisible();
  await expect(page.getByText('123456')).toBeVisible();
  await expect(page.getByText('Conectado')).toBeVisible();
  await page.getByRole('tab', { name: 'Planos alimentares' }).click();

  // 2. Paciente sem plano ainda
  await page.getByLabel('Id do paciente').fill('7');
  await page.getByRole('button', { name: 'Carregar plano ativo' }).click();
  await expect(page.getByRole('status')).toHaveText('Este paciente ainda não tem plano ativo.');

  // 3. Tentar prescrever vazio aponta os erros
  await page.getByRole('button', { name: 'Prescrever plano' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Corrija os campos destacados antes de prescrever.',
  );
  await expect(page.getByText('Dê um título ao plano.')).toBeVisible();

  // 4. Monta o plano: cafe da manha + almoco com dois alimentos da TACO
  await page.getByLabel(/^Título/).fill('Reeducação - fase 1');
  await page.getByLabel('Orientações gerais').fill('Beber 2 L de água por dia');

  const cafe = page.getByRole('group', { name: 'Refeição 1' });
  await cafe.getByLabel('Horário').fill('07:30');
  await cafe.getByLabel(/^Meta \(kcal\)/).fill('350');
  await cafe.getByLabel(/^Meta de proteínas/).fill('15');
  await pickFood(page, 1, 'feij', /Feijão, carioca/, '100');

  await page.getByRole('button', { name: '+ Adicionar refeição' }).click();
  const almoco = page.getByRole('group', { name: 'Refeição 2' });
  await almoco.getByLabel(/^Nome/).fill('Almoço');
  await almoco.getByLabel('Horário').fill('12:30');
  await almoco.getByLabel(/^Meta \(kcal\)/).fill('650');
  await almoco.getByLabel(/^Meta de proteínas/).fill('45,5');
  await pickFood(page, 2, 'arroz', /Arroz, tipo 1/, '150');
  await almoco.getByRole('button', { name: '+ Adicionar alimento' }).click();
  await pickFood(page, 2, 'frango', /Frango, peito/, '120');

  await expect(almoco.getByText(/Estimativa dos alimentos da TACO \(2 de 2\)/)).toContainText(
    '383 kcal de 650',
  );
  await expect(page.locator('.plan-summary')).toContainText('1.000 kcal');
  await expect(page.locator('.plan-summary')).toContainText('60,5 g');
  await expect(page.locator('.plan-summary')).toContainText('em 2 refeições');

  // 5. Prescreve
  await page.getByRole('button', { name: 'Prescrever plano' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Plano "Reeducação - fase 1" prescrito: agora é o plano ativo do paciente 7.',
  );
  expect(api.posted).toEqual([
    {
      titulo: 'Reeducação - fase 1',
      observacao: 'Beber 2 L de água por dia',
      refeicoes: [
        {
          nome: 'Café da manhã',
          horario: '07:30',
          meta_kcal: 350,
          meta_proteinas_g: 15,
          observacao: null,
          alimentos: [
            { nome_alimento: 'Feijão, carioca, cozido', quantidade_g: 100, alimento_taco_id: 556 },
          ],
        },
        {
          nome: 'Almoço',
          horario: '12:30',
          meta_kcal: 650,
          meta_proteinas_g: 45.5,
          observacao: null,
          alimentos: [
            { nome_alimento: 'Arroz, tipo 1, cozido', quantidade_g: 150, alimento_taco_id: 3 },
            {
              nome_alimento: 'Frango, peito, sem pele, grelhado',
              quantidade_g: 120,
              alimento_taco_id: 411,
            },
          ],
        },
      ],
    },
  ]);
  expect(api.authHeaders.every((h) => h === 'Bearer token-e2e')).toBe(true);

  // 6. Recomeca e reabre o plano ativo prescrito
  await page.getByRole('button', { name: 'Começar um plano novo' }).click();
  await expect(page.getByLabel(/^Título/)).toHaveValue('');
  await page.getByRole('button', { name: 'Carregar plano ativo' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Plano ativo "Reeducação - fase 1" carregado',
  );
  await expect(page.getByLabel(/^Título/)).toHaveValue('Reeducação - fase 1');
  await expect(almoco.getByLabel(/^Nome/)).toHaveValue('Almoço');
  await expect(almoco.getByLabel('Horário')).toHaveValue('12:30');
  await expect(almoco.getByRole('combobox', { name: 'Alimento' })).toHaveCount(2);

  // 7. A sessao sobrevive ao recarregar a pagina e Sair encerra
  await page.reload();
  await expect(page.getByText('Alex Silva')).toBeVisible();
  await expect(loginHeading(page)).toBeHidden();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(loginHeading(page)).toBeVisible();
});
