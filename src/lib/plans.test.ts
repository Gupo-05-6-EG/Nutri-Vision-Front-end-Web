import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import {
  LIMITS,
  type PlanDraft,
  describeError,
  draftGoals,
  emptyDraft,
  emptyFood,
  emptyMeal,
  estimateMeal,
  fromPlan,
  getActivePlan,
  parseNumber,
  toPayload,
  validateDraft,
} from '@/lib/plans';
import { arroz, detail, fakeApi, frango, json } from '@/test/fakeApi';
import type { Plan } from '@/types/plan';

function validDraft(): PlanDraft {
  const meal = emptyMeal('Almoço');
  meal.goalKcal = '650,5';
  meal.goalProtein = '40';
  meal.time = '12:30';
  meal.foods = [{ ...emptyFood(), name: arroz.nome, grams: '150', tacoId: arroz.id, taco: arroz }];
  return { title: 'Fase 1', note: '', meals: [meal] };
}

describe('parseNumber', () => {
  it.each([
    ['12,5', 12.5],
    ['12.5', 12.5],
    [' 7 ', 7],
    ['0', 0],
  ])('le %j como %d', (texto, esperado) => {
    expect(parseNumber(texto)).toBe(esperado);
  });

  it.each(['', '   ', 'abc', '1,2,3'])('devolve NaN para %j', (texto) => {
    expect(parseNumber(texto)).toBeNaN();
  });
});

describe('validateDraft', () => {
  it('rascunho valido nao tem erros', () => {
    expect(validateDraft(validDraft())).toEqual({});
  });

  it('o rascunho inicial aponta titulo, metas e alimento', () => {
    const draft = emptyDraft();
    const [meal] = draft.meals;
    const errors = validateDraft(draft);

    expect(errors.title).toBe('Dê um título ao plano.');
    expect(errors[`${meal.key}.goalKcal`]).toBe('Informe um número.');
    expect(errors[`${meal.key}.goalProtein`]).toBe('Informe um número.');
    expect(errors[`${meal.foods[0].key}.name`]).toBe('Informe o alimento.');
    expect(errors[`${meal.foods[0].key}.grams`]).toBe('Informe um número.');
    expect(errors[`${meal.key}.name`]).toBeUndefined(); // ja vem "Café da manhã"
  });

  it('meta zero e aceita, gramas zero nao', () => {
    const draft = validDraft();
    const [meal] = draft.meals;
    meal.goalKcal = '0';
    meal.foods[0].grams = '0';

    const errors = validateDraft(draft);

    expect(errors[`${meal.key}.goalKcal`]).toBeUndefined();
    expect(errors[`${meal.foods[0].key}.grams`]).toBe('Deve ser maior que zero.');
  });

  it('recusa negativos e valores acima dos limites do back-end', () => {
    const draft = validDraft();
    const [meal] = draft.meals;
    meal.goalProtein = '-1';
    meal.goalKcal = String(LIMITS.goalKcal + 1);
    meal.foods[0].grams = String(LIMITS.grams + 0.5);

    const errors = validateDraft(draft);

    expect(errors[`${meal.key}.goalProtein`]).toBe('Não pode ser negativo.');
    expect(errors[`${meal.key}.goalKcal`]).toBe('Máximo 10.000.');
    expect(errors[`${meal.foods[0].key}.grams`]).toBe('Máximo 5.000.');
  });

  it('aceita exatamente os limites', () => {
    const draft = validDraft();
    const [meal] = draft.meals;
    meal.goalKcal = String(LIMITS.goalKcal);
    meal.goalProtein = String(LIMITS.goalProtein);
    meal.foods[0].grams = String(LIMITS.grams);

    expect(validateDraft(draft)).toEqual({});
  });

  it('titulo e nomes so com espacos contam como vazios', () => {
    const draft = validDraft();
    draft.title = '   ';
    draft.meals[0].name = '  ';

    const errors = validateDraft(draft);

    expect(errors.title).toBeDefined();
    expect(errors[`${draft.meals[0].key}.name`]).toBe('Dê um nome à refeição.');
  });

  it('exige ao menos uma refeicao e um alimento por refeicao', () => {
    const semRefeicao = { ...validDraft(), meals: [] };
    expect(validateDraft(semRefeicao).meals).toBe('Adicione pelo menos uma refeição.');

    const draft = validDraft();
    draft.meals[0].foods = [];
    expect(validateDraft(draft)[`${draft.meals[0].key}.foods`]).toBe(
      'Adicione pelo menos um alimento.',
    );
  });

  it('limita refeicoes e alimentos por refeicao', () => {
    const draft = validDraft();
    draft.meals = Array.from({ length: LIMITS.meals + 1 }, () => validDraft().meals[0]);
    expect(validateDraft(draft).meals).toBe('No máximo 12 refeições.');

    const cheio = validDraft();
    const food = cheio.meals[0].foods[0];
    cheio.meals[0].foods = Array.from({ length: LIMITS.foodsPerMeal + 1 }, () => ({ ...food }));
    expect(validateDraft(cheio)[`${cheio.meals[0].key}.foods`]).toBe('No máximo 50 alimentos.');
  });
});

describe('toPayload', () => {
  it('converte o rascunho no corpo da API', () => {
    const draft = validDraft();
    draft.title = '  Fase 1  ';
    draft.meals[0].foods.push({ ...emptyFood(), name: ' Salada livre ', grams: '33,333' });

    expect(toPayload(draft)).toEqual({
      titulo: 'Fase 1',
      observacao: null,
      refeicoes: [
        {
          nome: 'Almoço',
          horario: '12:30',
          meta_kcal: 650.5,
          meta_proteinas_g: 40,
          meta_carboidratos_g: null,
          meta_gorduras_g: null,
          observacao: null,
          alimentos: [
            { nome_alimento: arroz.nome, quantidade_g: 150, alimento_taco_id: arroz.id },
            { nome_alimento: 'Salada livre', quantidade_g: 33.33, alimento_taco_id: null },
          ],
        },
      ],
    });
  });

  it('horario vazio vira null e observacoes sao mantidas', () => {
    const draft = validDraft();
    draft.note = 'Beber agua';
    draft.meals[0].time = '';
    draft.meals[0].note = ' sem acucar ';

    const payload = toPayload(draft);

    expect(payload.observacao).toBe('Beber agua');
    expect(payload.refeicoes[0].horario).toBeNull();
    expect(payload.refeicoes[0].observacao).toBe('sem acucar');
  });
});

const activePlan: Plan = {
  id: 5,
  paciente_id: 7,
  nutricionista_id: 10,
  titulo: 'Plano atual',
  observacao: null,
  ativo: true,
  criado_em: '2026-10-01T12:00:00Z',
  refeicoes: [
    {
      id: 1,
      nome: 'Jantar',
      horario: '19:45:00',
      meta_kcal: 500.5,
      meta_proteinas_g: 35,
      observacao: 'leve',
      alimentos: [
        { id: 1, nome_alimento: frango.nome, quantidade_g: 120.5, alimento_taco_id: 411 },
      ],
    },
  ],
  totais: { meta_kcal: 500.5, meta_proteinas_g: 35 },
};

describe('fromPlan', () => {
  it('converte o plano da API em rascunho editavel', () => {
    const draft = fromPlan(activePlan);
    const [meal] = draft.meals;

    expect(draft.title).toBe('Plano atual');
    expect(draft.note).toBe('');
    expect(meal).toMatchObject({
      name: 'Jantar',
      time: '19:45',
      goalKcal: '500,5',
      goalProtein: '35',
      note: 'leve',
    });
    expect(meal.foods[0]).toMatchObject({ name: frango.nome, grams: '120,5', tacoId: 411 });
  });

  it('ida e volta preserva o plano', () => {
    const payload = toPayload(fromPlan(activePlan));
    expect(payload.refeicoes[0]).toMatchObject({
      nome: 'Jantar',
      horario: '19:45',
      meta_kcal: 500.5,
      alimentos: [{ nome_alimento: frango.nome, quantidade_g: 120.5, alimento_taco_id: 411 }],
    });
    expect(validateDraft(fromPlan(activePlan))).toEqual({});
  });

  it('gera chaves unicas para cada bloco e alimento', () => {
    const a = fromPlan(activePlan);
    const b = fromPlan(activePlan);
    const keys = [a, b].flatMap((d) =>
      d.meals.flatMap((m) => [m.key, ...m.foods.map((f) => f.key)]),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('estimateMeal e draftGoals', () => {
  it('soma so os alimentos da TACO com gramas validas', () => {
    const meal = emptyMeal('Almoço');
    meal.foods = [
      { ...emptyFood(), name: arroz.nome, grams: '150', tacoId: arroz.id, taco: arroz },
      { ...emptyFood(), name: frango.nome, grams: '100', tacoId: frango.id, taco: frango },
      { ...emptyFood(), name: 'Livre', grams: '100' },
      { ...emptyFood(), name: arroz.nome, grams: '', tacoId: arroz.id, taco: arroz },
    ];

    expect(estimateMeal(meal)).toEqual({ kcal: 192 + 159, protein: 3.75 + 32, counted: 2 });
  });

  it('metas somam os blocos e ignoram campos invalidos', () => {
    const draft = validDraft();
    const outro = emptyMeal('Jantar');
    outro.goalKcal = '400';
    outro.goalProtein = 'x';
    draft.meals.push(outro);

    expect(draftGoals(draft)).toEqual({ kcal: 1050.5, protein: 40, carbs: 0, fat: 0 });
  });

  it('metas opcionais de carboidrato e gordura vao no corpo e somam', () => {
    const draft = validDraft();
    draft.meals[0].goalCarbs = '80,5';
    draft.meals[0].goalFat = '';

    const payload = toPayload(draft);
    expect(payload.refeicoes[0].meta_carboidratos_g).toBe(80.5);
    expect(payload.refeicoes[0].meta_gorduras_g).toBeNull();
    expect(draftGoals(draft).carbs).toBe(80.5);
    expect(
      validateDraft({ ...draft, meals: [{ ...draft.meals[0], goalFat: 'x' }] }),
    ).toHaveProperty(`${draft.meals[0].key}.goalFat`);
  });
});

describe('describeError', () => {
  it('usa o detail do FastAPI', () => {
    expect(describeError(new ApiError(404, '{"detail":"Paciente nao encontrado"}'))).toBe(
      'Paciente nao encontrado',
    );
  });

  it('detail de validacao (lista) vira mensagem com o status', () => {
    expect(describeError(new ApiError(422, '{"detail":[{"msg":"x"}]}'))).toBe('Erro 422 na API.');
  });

  it('corpo que nao e JSON vira mensagem com o status', () => {
    expect(describeError(new ApiError(502, 'Bad Gateway'))).toBe('Erro 502 na API.');
  });

  it('erros comuns e desconhecidos', () => {
    expect(describeError(new TypeError('Failed to fetch'))).toBe('Failed to fetch');
    expect(describeError('???')).toBe('Falha inesperada.');
  });
});

describe('getActivePlan', () => {
  it('devolve o plano ativo', async () => {
    fakeApi({ 'GET /pacientes/7/planos/ativo': () => json(activePlan) });
    await expect(getActivePlan(7)).resolves.toEqual(activePlan);
  });

  it('devolve null quando o paciente nao tem plano', async () => {
    fakeApi({ 'GET /pacientes/7/planos/ativo': () => detail('Paciente sem plano ativo', 404) });
    await expect(getActivePlan(7)).resolves.toBeNull();
  });

  it('propaga outros 404 (ex.: paciente inexistente)', async () => {
    fakeApi({ 'GET /pacientes/7/planos/ativo': () => detail('Paciente nao encontrado', 404) });
    await expect(getActivePlan(7)).rejects.toBeInstanceOf(ApiError);
  });
});
