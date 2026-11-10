import { describe, expect, it } from 'vitest';
import { diffPlans, formatDateTime } from '@/lib/planHistory';
import type { Plan, PlanMeal } from '@/types/plan';

let id = 0;
const meal = (patch: Partial<PlanMeal> & { nome: string }): PlanMeal => ({
  id: ++id,
  horario: null,
  meta_kcal: 500,
  meta_proteinas_g: 30,
  observacao: null,
  alimentos: [{ id: ++id, nome_alimento: 'Arroz', quantidade_g: 150, alimento_taco_id: null }],
  ...patch,
});

const plan = (patch: Partial<Plan> = {}): Plan => ({
  id: ++id,
  paciente_id: 7,
  nutricionista_id: 10,
  titulo: 'Plano A',
  observacao: null,
  ativo: true,
  criado_em: '2026-11-05T12:00:00Z',
  refeicoes: [meal({ nome: 'Almoço' })],
  totais: { meta_kcal: 500, meta_proteinas_g: 30 },
  ...patch,
});

const texts = (previous: Plan | null, current: Plan) =>
  diffPlans(previous, current).map((change) => `${change.kind}: ${change.text}`);

describe('diffPlans', () => {
  it('sem versão anterior é o plano criado', () => {
    expect(texts(null, plan())).toEqual(['added: Plano criado']);
  });

  it('planos iguais não têm mudanças, mesmo com ids diferentes', () => {
    expect(diffPlans(plan(), plan())).toEqual([]);
  });

  it('título e orientações gerais', () => {
    const before = plan({ observacao: 'Beber água' });
    const after = plan({ titulo: 'Plano B', observacao: 'Beber 2 L de água' });

    expect(texts(before, after)).toEqual([
      'changed: Título: “Plano A” → “Plano B”',
      'changed: Orientações gerais alteradas',
    ]);
  });

  it('horário, metas e observações de uma refeição', () => {
    const before = plan({ refeicoes: [meal({ nome: 'Almoço', horario: '12:00:00' })] });
    const after = plan({
      refeicoes: [
        meal({
          nome: 'Almoço',
          horario: '12:30:00',
          meta_kcal: 650.5,
          meta_proteinas_g: 40,
          observacao: 'Sem fritura',
        }),
      ],
    });

    expect(texts(before, after)).toEqual([
      'changed: Almoço: horário 12:00 → 12:30',
      'changed: Almoço: meta 500 → 650,5 kcal',
      'changed: Almoço: proteína 30 → 40 g',
      'changed: Almoço: observações alteradas',
    ]);
  });

  it('horário que aparece ou some', () => {
    const before = plan({ refeicoes: [meal({ nome: 'Almoço' })] });
    const after = plan({ refeicoes: [meal({ nome: 'Almoço', horario: '12:00:00' })] });

    expect(texts(before, after)).toEqual(['changed: Almoço: horário sem horário → 12:00']);
    expect(texts(after, before)).toEqual(['changed: Almoço: horário 12:00 → sem horário']);
  });

  it('alimentos adicionados, removidos e com quantidade alterada', () => {
    const food = (nome_alimento: string, quantidade_g: number) => ({
      id: ++id,
      nome_alimento,
      quantidade_g,
      alimento_taco_id: null,
    });
    const before = plan({
      refeicoes: [meal({ nome: 'Almoço', alimentos: [food('Arroz', 150), food('Feijão', 100)] })],
    });
    const after = plan({
      refeicoes: [meal({ nome: 'Almoço', alimentos: [food('Arroz', 200), food('Frango', 120)] })],
    });

    expect(texts(before, after)).toEqual([
      'changed: Almoço: Arroz 150 g → 200 g',
      'added: Almoço: + Frango (120 g)',
      'removed: Almoço: − Feijão',
    ]);
  });

  it('o mesmo alimento repetido no bloco é comparado ocorrência por ocorrência', () => {
    const food = (quantidade_g: number) => ({
      id: ++id,
      nome_alimento: 'Ovo',
      quantidade_g,
      alimento_taco_id: null,
    });
    const before = plan({ refeicoes: [meal({ nome: 'Café', alimentos: [food(50)] })] });
    const after = plan({ refeicoes: [meal({ nome: 'Café', alimentos: [food(50), food(50)] })] });

    expect(texts(before, after)).toEqual(['added: Café: + Ovo (50 g)']);
  });

  it('refeições adicionadas e removidas, comparando o nome sem diferenciar caixa', () => {
    const before = plan({ refeicoes: [meal({ nome: 'Almoço' }), meal({ nome: 'Ceia' })] });
    const after = plan({ refeicoes: [meal({ nome: 'ALMOÇO' }), meal({ nome: 'Jantar' })] });

    expect(texts(before, after)).toEqual([
      'added: Refeição “Jantar” adicionada',
      'removed: Refeição “Ceia” removida',
    ]);
  });
});

describe('formatDateTime', () => {
  it('mostra data e hora no horário de Brasília', () => {
    // 12:00 UTC = 09:00 em Brasília (UTC-3).
    expect(formatDateTime('2026-11-05T12:00:00Z')).toBe('05/11/2026 às 09:00');
  });

  it('meia-noite em Brasília não vira 24:00', () => {
    expect(formatDateTime('2026-11-05T03:05:00Z')).toBe('05/11/2026 às 00:05');
  });

  it('data inválida vira traço', () => {
    expect(formatDateTime('ontem')).toBe('—');
  });
});
