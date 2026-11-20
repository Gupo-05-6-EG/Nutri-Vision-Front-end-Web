import { render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PlanBuilderPage } from '@/pages/PlanBuilderPage';
import { type Call, arroz, detail, fakeApi, frango, json } from '@/test/fakeApi';
import type { Plan, PlanInput } from '@/types/plan';

const savedPlan = (call: Call, patient = 7): Plan => {
  const body = call.body as PlanInput;
  return {
    id: 99,
    paciente_id: patient,
    nutricionista_id: 10,
    titulo: body.titulo,
    observacao: body.observacao ?? null,
    ativo: true,
    criado_em: '2026-11-05T12:00:00Z',
    refeicoes: [],
    totais: { meta_kcal: 0, meta_proteinas_g: 0 },
  };
};

const activePlan: Plan = {
  id: 5,
  paciente_id: 7,
  nutricionista_id: 10,
  titulo: 'Plano de outubro',
  observacao: 'Beber 2 L de água',
  ativo: true,
  criado_em: '2026-10-01T12:00:00Z',
  refeicoes: [
    {
      id: 1,
      nome: 'Almoço',
      horario: '12:00:00',
      meta_kcal: 700,
      meta_proteinas_g: 45,
      observacao: null,
      alimentos: [{ id: 1, nome_alimento: arroz.nome, quantidade_g: 150, alimento_taco_id: 3 }],
    },
    {
      id: 2,
      nome: 'Jantar',
      horario: null,
      meta_kcal: 500,
      meta_proteinas_g: 30,
      observacao: null,
      alimentos: [{ id: 2, nome_alimento: 'Sopa', quantidade_g: 300, alimento_taco_id: null }],
    },
  ],
  totais: { meta_kcal: 1200, meta_proteinas_g: 75 },
};

const meal = (n: number) => within(screen.getByRole('group', { name: `Refeição ${n}` }));

function setup(routes: Parameters<typeof fakeApi>[0] = {}) {
  const api = fakeApi({
    'GET /patients': () =>
      json([
        { paciente_id: 7, nome: 'Alex Silva', email: 'alex@email.com', status: 'ativo' },
        { paciente_id: 8, nome: 'Bia Souza', email: 'bia@email.com', status: 'ativo' },
      ]),
    'GET /alimentos-taco': (call) =>
      json([arroz, frango].filter((f) => f.nome.toLowerCase().includes(searchTerm(call)))),
    ...routes,
  });
  render(<PlanBuilderPage />);
  return { user: userEvent.setup(), ...api };
}

const searchTerm = (call: Call) =>
  new URLSearchParams(call.path.split('?')[1]).get('nome')!.toLowerCase();

/** Preenche o bloco `n` com metas e o primeiro alimento escolhido da TACO. */
async function fillMeal(user: UserEvent, n: number, food = 'arroz', grams = '150') {
  const block = meal(n);
  await user.type(block.getByLabelText('Meta (kcal)'), '600');
  await user.type(block.getByLabelText('Meta de proteínas (g)'), '35,5');
  await user.type(block.getAllByRole('combobox', { name: 'Alimento' })[0], food);
  await user.click(await block.findByRole('option', { name: new RegExp(food, 'i') }));
  await user.type(block.getAllByLabelText('Quantidade em gramas')[0], grams);
}

describe('PlanBuilderPage - validacao', () => {
  it('prescrever vazio aponta os campos sem chamar a API', async () => {
    const { user, calls } = setup();
    await user.selectOptions(await screen.findByLabelText('Paciente'), '7');

    await user.click(screen.getByRole('button', { name: 'Prescrever plano' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Corrija os campos destacados antes de prescrever.',
    );
    expect(screen.getByText('Dê um título ao plano.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Título/)).toHaveAttribute('aria-invalid', 'true');
    expect(meal(1).getByText('Informe o alimento.')).toBeInTheDocument();
    expect(meal(1).getAllByText('Informe um número.')).toHaveLength(3);
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('exige escolher o paciente', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Prescrever plano' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha o paciente.');
  });

  it('paciente e escolhido pelo nome, nao pelo id', async () => {
    const { user } = setup();
    const select = await screen.findByLabelText('Paciente');
    expect(
      await screen.findByRole('option', { name: 'Alex Silva (alex@email.com)' }),
    ).toBeInTheDocument();
    await user.selectOptions(select, '8');
    expect(select).toHaveValue('8');
  });

  it('depois da primeira tentativa, corrigir o campo tira o erro', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Prescrever plano' }));
    expect(screen.getByText('Dê um título ao plano.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Título/), 'Fase 1');

    expect(screen.queryByText('Dê um título ao plano.')).not.toBeInTheDocument();
  });

  it('mostra o limite quando a meta passa do maximo', async () => {
    const { user } = setup();
    await user.type(meal(1).getByLabelText('Meta (kcal)'), '20000');
    await user.click(screen.getByRole('button', { name: 'Prescrever plano' }));
    expect(meal(1).getByText('Máximo 10.000.')).toBeInTheDocument();
  });
});

describe('PlanBuilderPage - blocos e alimentos', () => {
  it('adiciona refeicoes com o proximo nome sugerido e soma as metas', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: '+ Adicionar refeição' }));
    await user.click(screen.getByRole('button', { name: '+ Adicionar refeição' }));

    expect(meal(2).getByLabelText('Nome')).toHaveValue('Lanche da manhã');
    expect(meal(3).getByLabelText('Nome')).toHaveValue('Almoço');

    await user.type(meal(1).getByLabelText('Meta (kcal)'), '400');
    await user.type(meal(3).getByLabelText('Meta (kcal)'), '700,6');
    await user.type(meal(3).getByLabelText('Meta de proteínas (g)'), '40,25');

    expect(screen.getByText(/1\.101 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/40,3 g/)).toBeInTheDocument();
    expect(screen.getByText(/em 3 refeições/)).toBeInTheDocument();
  });

  it('move e remove blocos; o ultimo bloco nao pode ser removido', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: '+ Adicionar refeição' }));

    expect(screen.getByRole('button', { name: 'Mover Café da manhã para cima' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Mover Café da manhã para baixo' }));
    expect(meal(1).getByLabelText('Nome')).toHaveValue('Lanche da manhã');
    expect(meal(2).getByLabelText('Nome')).toHaveValue('Café da manhã');

    await user.click(screen.getByRole('button', { name: 'Remover Lanche da manhã' }));
    expect(screen.queryByRole('group', { name: 'Refeição 2' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Café da manhã' })).toBeDisabled();
  });

  it('adiciona e remove alimentos no bloco', async () => {
    const { user } = setup();
    await user.click(meal(1).getByRole('button', { name: '+ Adicionar alimento' }));
    const foods = meal(1).getAllByRole('combobox', { name: 'Alimento' });
    expect(foods).toHaveLength(2);

    await user.type(foods[1], 'Pão de queijo');
    await user.click(meal(1).getByRole('button', { name: 'Remover Pão de queijo' }));

    expect(meal(1).getAllByRole('combobox', { name: 'Alimento' })).toHaveLength(1);
    expect(meal(1).getByRole('button', { name: 'Remover alimento' })).toBeDisabled();
  });

  it('alimento da TACO ganha selo e entra na estimativa do bloco', async () => {
    const { user } = setup();
    await fillMeal(user, 1, 'arroz', '150'); // meta de 600 kcal e 35,5 g

    expect(meal(1).getByRole('combobox', { name: 'Alimento' })).toHaveValue(arroz.nome);
    expect(meal(1).getByTitle('Alimento ligado à tabela TACO')).toBeInTheDocument();
    const estimate = meal(1).getByText(/Estimativa dos alimentos da TACO \(1 de 1\)/);
    expect(estimate).toHaveTextContent('192 kcal de 600');
    expect(estimate).toHaveTextContent('3,8 g de proteína de 35,5');
    expect(within(estimate).getByText('192 kcal')).not.toHaveClass('over');
  });

  it('estimativa acima da meta fica destacada', async () => {
    const { user } = setup();
    await user.type(meal(1).getByLabelText('Meta (kcal)'), '100');
    await user.type(meal(1).getByRole('combobox', { name: 'Alimento' }), 'frango');
    await user.click(await meal(1).findByRole('option', { name: /Frango/ }));
    await user.type(meal(1).getByLabelText('Quantidade em gramas'), '100');

    expect(meal(1).getByText('159 kcal')).toHaveClass('over');
  });

  it('voltar a digitar desliga o alimento da TACO', async () => {
    const { user } = setup();
    const input = meal(1).getByRole('combobox', { name: 'Alimento' });
    await user.type(input, 'arroz');
    await user.click(await meal(1).findByRole('option', { name: /Arroz/ }));
    await user.type(input, ' integral');

    expect(input).toHaveValue(`${arroz.nome} integral`);
    expect(meal(1).queryByTitle('Alimento ligado à tabela TACO')).not.toBeInTheDocument();
  });
});

describe('PlanBuilderPage - prescrever', () => {
  it('envia o plano montado para o paciente e confirma', async () => {
    const { user, calls } = setup({
      'POST /pacientes/7/planos': (call) => json(savedPlan(call), 201),
    });
    await user.selectOptions(await screen.findByLabelText('Paciente'), '7');
    await user.type(screen.getByLabelText(/^Título/), 'Reeducação - fase 1');
    await user.type(screen.getByLabelText('Orientações gerais'), 'Beber água');
    await fillMeal(user, 1, 'arroz', '120,5');
    await user.type(meal(1).getByLabelText('Horário'), '07:30');

    await user.click(screen.getByRole('button', { name: 'Prescrever plano' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Plano "Reeducação - fase 1" prescrito: agora é o plano ativo do paciente.',
    );
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.path).toBe('/pacientes/7/planos');
    expect(post.body).toEqual({
      titulo: 'Reeducação - fase 1',
      observacao: 'Beber água',
      refeicoes: [
        {
          nome: 'Café da manhã',
          horario: '07:30',
          meta_kcal: 600,
          meta_proteinas_g: 35.5,
          meta_carboidratos_g: null,
          meta_gorduras_g: null,
          observacao: null,
          alimentos: [{ nome_alimento: arroz.nome, quantidade_g: 120.5, alimento_taco_id: 3 }],
        },
      ],
    });

    // Depois de prescrever, da para recomecar do zero
    await user.click(screen.getByRole('button', { name: 'Começar um plano novo' }));
    expect(screen.getByLabelText(/^Título/)).toHaveValue('');
  });

  it('Enter no campo de alimento nao envia o plano pela metade', async () => {
    const { user, calls } = setup();
    await user.selectOptions(await screen.findByLabelText('Paciente'), '7');
    await user.type(meal(1).getByRole('combobox', { name: 'Alimento' }), 'Banana{Enter}');

    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('erro da API aparece com o detail', async () => {
    const { user } = setup({
      'POST /pacientes/7/planos': () => detail('Paciente nao vinculado a este nutricionista', 403),
    });
    await user.selectOptions(await screen.findByLabelText('Paciente'), '7');
    await user.type(screen.getByLabelText(/^Título/), 'Plano');
    await fillMeal(user, 1);

    await user.click(screen.getByRole('button', { name: 'Prescrever plano' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Paciente nao vinculado a este nutricionista',
    );
    expect(screen.getByRole('button', { name: 'Prescrever plano' })).toBeEnabled();
  });

  it('mostra Prescrevendo e trava o botao enquanto envia', async () => {
    let respond!: (r: Response) => void;
    const { user } = setup({
      'POST /pacientes/7/planos': () => new Promise<Response>((resolve) => (respond = resolve)),
    });
    await user.selectOptions(await screen.findByLabelText('Paciente'), '7');
    await user.type(screen.getByLabelText(/^Título/), 'Plano');
    await fillMeal(user, 1);

    await user.click(screen.getByRole('button', { name: 'Prescrever plano' }));

    expect(screen.getByRole('button', { name: 'Prescrevendo…' })).toBeDisabled();
    respond(json({ ...activePlan, titulo: 'Plano' }, 201));
    expect(await screen.findByRole('status')).toHaveTextContent('Plano "Plano" prescrito');
  });
});

describe('PlanBuilderPage - plano ativo', () => {
  it('carrega o plano ativo para editar', async () => {
    const { user } = setup({ 'GET /pacientes/7/planos/ativo': () => json(activePlan) });
    expect(screen.getByRole('button', { name: 'Carregar plano ativo' })).toBeDisabled();
    await user.selectOptions(await screen.findByLabelText('Paciente'), '7');

    await user.click(screen.getByRole('button', { name: 'Carregar plano ativo' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Plano ativo "Plano de outubro" carregado. Ao prescrever, ele é substituído.',
    );
    expect(screen.getByLabelText(/^Título/)).toHaveValue('Plano de outubro');
    expect(screen.getByLabelText('Orientações gerais')).toHaveValue('Beber 2 L de água');
    expect(meal(1).getByLabelText('Nome')).toHaveValue('Almoço');
    expect(meal(1).getByLabelText('Horário')).toHaveValue('12:00');
    expect(meal(2).getByRole('combobox', { name: 'Alimento' })).toHaveValue('Sopa');
    expect(screen.getByText(/1\.200 kcal/)).toBeInTheDocument();
  });

  it('avisa quando o paciente nao tem plano ativo', async () => {
    const { user } = setup({
      'GET /pacientes/7/planos/ativo': () => detail('Paciente sem plano ativo', 404),
    });
    await user.selectOptions(await screen.findByLabelText('Paciente'), '7');
    await user.click(screen.getByRole('button', { name: 'Carregar plano ativo' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Este paciente ainda não tem plano ativo.',
    );
    expect(screen.getByLabelText(/^Título/)).toHaveValue('');
  });

  it('mostra o erro quando o paciente nao existe', async () => {
    const { user } = setup({
      'GET /pacientes/8/planos/ativo': () => detail('Paciente nao encontrado', 404),
    });
    await user.selectOptions(await screen.findByLabelText('Paciente'), '8');
    await user.click(screen.getByRole('button', { name: 'Carregar plano ativo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Paciente nao encontrado');
  });

  it('com initialPlan já abre o plano para editar, sem chamar a API', async () => {
    const { calls } = fakeApi({
      'GET /patients': () =>
        json([{ paciente_id: 7, nome: 'Alex Silva', email: 'alex@email.com', status: 'ativo' }]),
    });
    render(<PlanBuilderPage initialPlan={activePlan} />);

    expect(screen.getByLabelText(/^Título/)).toHaveValue('Plano de outubro');
    expect(
      await screen.findByRole('option', { name: 'Alex Silva (alex@email.com)' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Paciente')).toHaveValue('7');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Plano ativo "Plano de outubro" carregado. Ao prescrever, ele é substituído.',
    );
    expect(meal(2).getByRole('combobox', { name: 'Alimento' })).toHaveValue('Sopa');
    // So a lista de pacientes e a consulta do rascunho: o plano ja veio pronto.
    expect(calls.filter((c) => c.path.includes('/planos/ativo'))).toHaveLength(0);
  });
});

describe('PlanBuilderPage - rascunho', () => {
  it('salva o rascunho sem prescrever e avisa quando ha um salvo', async () => {
    const draftPlan = { ...activePlan, id: 40, titulo: 'Rascunho de dezembro', ativo: false };
    const { user, calls } = setup({
      'PUT /pacientes/7/planos/rascunho': () => json(draftPlan),
      'GET /pacientes/7/planos/rascunho': () => json(draftPlan),
    });

    await user.selectOptions(await screen.findByLabelText('Paciente'), '7');
    expect(await screen.findByText(/Há um rascunho salvo/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar rascunho' }));
    expect(screen.getByLabelText(/^Título/)).toHaveValue('Rascunho de dezembro');

    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Rascunho salvo.');
    expect(calls.some((c) => c.method === 'PUT' && c.path === '/pacientes/7/planos/rascunho')).toBe(
      true,
    );
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
