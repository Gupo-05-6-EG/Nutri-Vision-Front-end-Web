import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlanHistoryPage } from '@/pages/PlanHistoryPage';
import { detail, fakeApi, json } from '@/test/fakeApi';
import type { PlanVersion } from '@/types/plan';

const food = (id: number, nome_alimento: string, quantidade_g: number) => ({
  id,
  nome_alimento,
  quantidade_g,
  alimento_taco_id: null,
});

const v1: PlanVersion = {
  id: 1,
  paciente_id: 7,
  nutricionista_id: 10,
  titulo: 'Plano inicial',
  observacao: null,
  ativo: false,
  criado_em: '2026-11-01T12:00:00Z',
  versao: 1,
  autor: { id: 10, nome: 'Dra. Ana' },
  refeicoes: [
    {
      id: 1,
      nome: 'Almoço',
      horario: '12:00:00',
      meta_kcal: 600,
      meta_proteinas_g: 35,
      observacao: null,
      alimentos: [food(1, 'Arroz', 150)],
    },
  ],
  totais: { meta_kcal: 600, meta_proteinas_g: 35 },
};

const v2: PlanVersion = {
  ...v1,
  id: 2,
  titulo: 'Plano ajustado',
  ativo: true,
  criado_em: '2026-11-05T12:00:00Z',
  versao: 2,
  autor: { id: 11, nome: 'Dr. Bruno' },
  refeicoes: [
    {
      ...v1.refeicoes[0],
      id: 2,
      meta_kcal: 700,
      alimentos: [food(2, 'Arroz', 200), food(3, 'Frango', 120)],
    },
  ],
  totais: { meta_kcal: 700, meta_proteinas_g: 35 },
};

async function open(
  routes: Parameters<typeof fakeApi>[0],
  onEdit: (plan: PlanVersion) => void = () => {},
) {
  const api = fakeApi({
    'GET /patients': () =>
      json([
        { paciente_id: 7, nome: 'Alex Silva', email: 'alex@email.com', status: 'ativo' },
        { paciente_id: 8, nome: 'Bia Souza', email: 'bia@email.com', status: 'ativo' },
      ]),
    ...routes,
  });
  render(<PlanHistoryPage onEdit={onEdit} />);
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByLabelText('Paciente'), '7');
  await user.click(screen.getByRole('button', { name: 'Ver histórico' }));
  return { user, ...api };
}

const version = (n: number) => screen.getByRole('heading', { name: `Versão ${n}` }).closest('li')!;

describe('PlanHistoryPage', () => {
  it('só busca depois de informar um paciente válido', () => {
    const { calls } = fakeApi({
      'GET /patients': () =>
        json([
          { paciente_id: 7, nome: 'Alex Silva', email: 'alex@email.com', status: 'ativo' },
          { paciente_id: 8, nome: 'Bia Souza', email: 'bia@email.com', status: 'ativo' },
        ]),
    });
    render(<PlanHistoryPage onEdit={() => {}} />);

    expect(screen.getByRole('button', { name: 'Ver histórico' })).toBeDisabled();
    expect(calls.filter((c) => c.path.includes('/planos'))).toHaveLength(0);
  });

  it('lista as versões da mais nova para a mais antiga, com autor e data/hora', async () => {
    const { calls } = await open({ 'GET /pacientes/7/planos/versoes': () => json([v2, v1]) });

    await screen.findByText('Versão 2');
    expect(calls.find((c) => c.path.includes('/planos'))?.path).toBe('/pacientes/7/planos/versoes');
    expect(screen.getByText('2 versões')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Versão 2', 'Versão 1']);

    expect(within(version(2)).getByText('Ativa')).toBeInTheDocument();
    expect(within(version(2)).getByText('Dr. Bruno · 05/11/2026 às 09:00')).toBeInTheDocument();
    expect(within(version(1)).queryByText('Ativa')).not.toBeInTheDocument();
    expect(within(version(1)).getByText('Dra. Ana · 01/11/2026 às 09:00')).toBeInTheDocument();
  });

  it('mostra o que mudou em cada versão', async () => {
    await open({ 'GET /pacientes/7/planos/versoes': () => json([v2, v1]) });
    await screen.findByText('Versão 2');

    const changes = within(version(2));
    expect(changes.getByText(/Título: “Plano inicial” → “Plano ajustado”/)).toBeInTheDocument();
    expect(changes.getByText(/Almoço: meta 600 → 700 kcal/)).toBeInTheDocument();
    expect(changes.getByText(/Almoço: Arroz 150 g → 200 g/)).toBeInTheDocument();
    expect(changes.getByText(/Almoço: \+ Frango \(120 g\)/)).toBeInTheDocument();
    // A primeira versão é só o plano criado.
    expect(within(version(1)).getByText(/Plano criado/)).toBeInTheDocument();
  });

  it('versão sem diferenças e autor removido', async () => {
    const same: PlanVersion = { ...v1, id: 3, versao: 3, autor: null, ativo: true };
    await open({ 'GET /pacientes/7/planos/versoes': () => json([same, v1]) });
    await screen.findByText('Versão 3');

    expect(within(version(3)).getByText('Sem alterações nos dados do plano.')).toBeInTheDocument();
    expect(within(version(3)).getByText(/Autor removido/)).toBeInTheDocument();
  });

  it('o plano completo da versão fica em um bloco expansível', async () => {
    await open({ 'GET /pacientes/7/planos/versoes': () => json([v1]) });
    await screen.findByText('Versão 1');

    const details = within(version(1));
    expect(details.getByText('Ver plano completo')).toBeInTheDocument();
    expect(details.getByText('Arroz — 150 g')).toBeInTheDocument();
    expect(details.getByText(/12:00/)).toBeInTheDocument();
  });

  it('paciente sem plano mostra o aviso e não oferece edição', async () => {
    await open({ 'GET /pacientes/7/planos/versoes': () => json([]) });

    expect(await screen.findByText('Este paciente ainda não tem plano.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar plano ativo' })).not.toBeInTheDocument();
  });

  it('erro da API aparece como alerta', async () => {
    await open({
      'GET /pacientes/7/planos/versoes': () => detail('Sem vinculo com este paciente', 403),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem vinculo com este paciente');
  });

  it('Editar plano ativo entrega o plano ativo para o construtor', async () => {
    const onEdit = vi.fn();
    const { user } = await open(
      { 'GET /pacientes/7/planos/versoes': () => json([v2, v1]) },
      onEdit,
    );

    await user.click(await screen.findByRole('button', { name: 'Editar plano ativo' }));

    expect(onEdit).toHaveBeenCalledWith(v2);
  });
});
