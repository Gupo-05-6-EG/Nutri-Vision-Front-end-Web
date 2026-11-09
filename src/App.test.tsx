import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '@/App';
import { detail, fakeApi, fakeJwt, json, loginResponse } from '@/test/fakeApi';

const health = () => json({ status: 'ok', service: 'nutri-vision-api', environment: 'test' });
const patients = () =>
  json([{ paciente_id: 7, nome: 'Alex Silva', email: 'alex@email.com', status: 'ativo' }]);

const loginHeading = () => screen.queryByRole('heading', { name: 'Bem-vindo de volta' });

async function login() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-mail profissional'), 'ana@exemplo.com');
  await user.type(screen.getByLabelText('Senha de acesso'), 'senha-forte-123');
  await user.click(screen.getByRole('button', { name: 'Entrar no painel clínico' }));
  return user;
}

describe('App', () => {
  it('sem sessao abre no login e alterna para o cadastro', async () => {
    const { calls } = fakeApi({});
    render(<App />);
    const user = userEvent.setup();

    expect(loginHeading()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cadastre-se aqui' }));
    expect(
      screen.getByRole('heading', { name: 'Crie a sua conta profissional' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fazer login' }));
    expect(loginHeading()).toBeInTheDocument();

    // Nada e chamado antes de entrar.
    expect(calls).toHaveLength(0);
  });

  it('login abre a area logada com pacientes, status da API e abas', async () => {
    const { calls } = fakeApi({
      'POST /auth/login': () => loginResponse(),
      'GET /health': health,
      'GET /patients': patients,
    });
    render(<App />);

    const user = await login();

    expect(await screen.findByText('Alex Silva')).toBeInTheDocument();
    expect(await screen.findByText('Conectado')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pacientes' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Planos alimentares' }));

    expect(screen.getByRole('tab', { name: 'Planos alimentares' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-plans');
    expect(screen.getByRole('button', { name: 'Prescrever plano' })).toBeInTheDocument();
    expect(screen.queryByText('Alex Silva')).not.toBeInTheDocument();

    // Todas as chamadas depois do login levam o token.
    const authed = calls.filter((c) => c.path !== '/auth/login');
    expect(authed.every((c) => c.headers.get('Authorization') === 'Bearer token-da-ana')).toBe(
      true,
    );
  });

  it('Sair volta ao login e apaga o token', async () => {
    fakeApi({
      'POST /auth/login': () => loginResponse(),
      'GET /health': health,
      'GET /patients': patients,
    });
    render(<App />);
    const user = await login();
    await screen.findByText('Alex Silva');

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(loginHeading()).toBeInTheDocument();
    expect(localStorage.getItem('nutrivision.token')).toBeNull();
  });

  it('restaura a sessao salva com token valido', async () => {
    const token = fakeJwt(1);
    localStorage.setItem('nutrivision.token', token);
    const { calls } = fakeApi({ 'GET /health': health, 'GET /patients': patients });

    render(<App />);

    expect(loginHeading()).not.toBeInTheDocument();
    expect(await screen.findByText('Alex Silva')).toBeInTheDocument();
    expect(calls[0].headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('401 da API encerra a sessao e avisa no login', async () => {
    localStorage.setItem('nutrivision.token', fakeJwt(1));
    fakeApi({
      'GET /health': health,
      'GET /patients': () => detail('Token invalido', 401),
    });

    render(<App />);

    expect(await screen.findByRole('status')).toHaveTextContent('Sua sessão expirou.');
    expect(loginHeading()).toBeInTheDocument();
    expect(localStorage.getItem('nutrivision.token')).toBeNull();
  });

  it('API fora do ar aparece no cartao de conexao', async () => {
    localStorage.setItem('nutrivision.token', fakeJwt(1));
    fakeApi({
      'GET /health': () => {
        throw new TypeError('Failed to fetch');
      },
      'GET /patients': patients,
    });
    render(<App />);

    expect(await screen.findByText('Sem conexão')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });
});
