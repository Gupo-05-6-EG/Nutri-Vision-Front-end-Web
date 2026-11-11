import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PatientsPage } from '@/pages/PatientsPage';
import { detail, fakeApi, json } from '@/test/fakeApi';

const alex = {
  paciente_id: 7,
  nome: 'Alex Silva',
  email: 'alex@email.com',
  status: 'ativo',
  vinculado_em: '2026-11-01T12:00:00Z',
};
const bia = { paciente_id: 8, nome: 'Bia Souza', email: 'bia@email.com', status: 'ativo' };

const item = (name: string) => screen.getByText(name).closest('li')!;

describe('PatientsPage', () => {
  it('lista os pacientes vinculados', async () => {
    fakeApi({ 'GET /patients': () => json([alex, bia]) });
    render(<PatientsPage />);

    expect(screen.getByText('Carregando…')).toBeInTheDocument();
    expect(await screen.findByText('Alex Silva')).toBeInTheDocument();
    expect(within(item('Alex Silva')).getByText('alex@email.com')).toBeInTheDocument();
    expect(within(item('Alex Silva')).getByText('Vinculado em 01/11/2026')).toBeInTheDocument();
    expect(within(item('Bia Souza')).getByText('Vinculado em —')).toBeInTheDocument();
  });

  it('sem pacientes mostra o aviso', async () => {
    fakeApi({ 'GET /patients': () => json([]) });
    render(<PatientsPage />);

    expect(await screen.findByText('Você ainda não tem pacientes vinculados.')).toBeInTheDocument();
  });

  it('a busca vai para a API depois de parar de digitar', async () => {
    const { calls } = fakeApi({
      'GET /patients': (call) => json(call.path.includes('busca=') ? [bia] : [alex, bia]),
    });
    render(<PatientsPage />);
    await screen.findByText('Alex Silva');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Buscar paciente'), 'bia');

    await waitFor(() => expect(screen.queryByText('Alex Silva')).not.toBeInTheDocument());
    expect(screen.getByText('Bia Souza')).toBeInTheDocument();
    // Uma chamada inicial e uma so para a busca (nao uma por tecla).
    expect(calls.map((c) => c.path)).toEqual(['/patients', '/patients?busca=bia']);
  });

  it('busca sem resultado', async () => {
    fakeApi({ 'GET /patients': (call) => json(call.path.includes('busca=') ? [] : [alex]) });
    render(<PatientsPage />);
    await screen.findByText('Alex Silva');

    await userEvent.setup().type(screen.getByLabelText('Buscar paciente'), 'zzz');

    expect(
      await screen.findByText('Nenhum paciente encontrado para essa busca.'),
    ).toBeInTheDocument();
  });

  it('erro ao listar permite tentar de novo', async () => {
    let fail = true;
    fakeApi({
      'GET /patients': () => (fail ? new Response('', { status: 500 }) : json([alex])),
    });
    render(<PatientsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('servidor está indisponível');
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Alex Silva')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('desvincular pede confirmacao e tira o paciente da lista', async () => {
    const { calls } = fakeApi({
      'GET /patients': () => json([alex, bia]),
      'DELETE /patients/7': () => new Response(null, { status: 204 }),
    });
    render(<PatientsPage />);
    await screen.findByText('Alex Silva');
    const user = userEvent.setup();

    await user.click(within(item('Alex Silva')).getByRole('button', { name: 'Desvincular' }));
    expect(screen.getByText('Desvincular Alex Silva?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Desvincular Alex Silva?')).not.toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);

    await user.click(within(item('Alex Silva')).getByRole('button', { name: 'Desvincular' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(screen.queryByText('Alex Silva')).not.toBeInTheDocument());
    expect(screen.getByText('Bia Souza')).toBeInTheDocument();
    expect(calls.at(-1)).toMatchObject({ method: 'DELETE', path: '/patients/7' });
  });

  it('erro ao desvincular mantem o paciente e mostra a mensagem', async () => {
    fakeApi({
      'GET /patients': () => json([alex]),
      'DELETE /patients/7': () => detail('Vinculo inexistente', 404),
    });
    render(<PatientsPage />);
    await screen.findByText('Alex Silva');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Desvincular' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vínculo não encontrado. Atualize a lista.',
    );
    expect(screen.getByText('Alex Silva')).toBeInTheDocument();
  });

  it('exibe icone e badge de alerta vermelho se streak == 0 por 3 dias consecutivos', async () => {
    const emAbandono = {
      paciente_id: 9,
      nome: 'Carlos Lima',
      email: 'carlos@email.com',
      status: 'ativo',
      streak: 0,
      dias_streak_zero: 3,
    };
    const doisDias = {
      paciente_id: 10,
      nome: 'Dora Nunes',
      email: 'dora@email.com',
      status: 'ativo',
      streak: 0,
      dias_streak_zero: 2,
    };
    const ativoStreak = {
      paciente_id: 11,
      nome: 'Eva Rocha',
      email: 'eva@email.com',
      status: 'ativo',
      streak: 5,
      dias_streak_zero: 0,
    };
    fakeApi({ 'GET /patients': () => json([emAbandono, doisDias, ativoStreak]) });
    render(<PatientsPage />);

    expect(await screen.findByText('Carlos Lima')).toBeInTheDocument();
    expect(
      within(item('Carlos Lima')).getByLabelText(
        /Alerta de abandono: Carlos Lima com ofensiva zerada por 3 ou mais dias consecutivos/i,
      ),
    ).toBeInTheDocument();
    expect(within(item('Dora Nunes')).queryByText('Alerta de abandono')).not.toBeInTheDocument();
    expect(within(item('Eva Rocha')).getByText('Ofensiva: 5d')).toBeInTheDocument();
  });
});
