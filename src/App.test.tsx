import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '@/App';
import { fakeApi, json, loginResponse, nutritionist } from '@/test/fakeApi';

const health = () => json({ status: 'ok', service: 'nutri-vision-api', environment: 'test' });

describe('App', () => {
  it('sem sessao abre no login e mostra o status da API', async () => {
    fakeApi({ 'GET /health': health });
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(await screen.findByText('Conectado')).toBeInTheDocument();
    expect(screen.getByText('nutri-vision-api')).toBeInTheDocument();
  });

  it('API fora do ar aparece no cartao de conexao', async () => {
    fakeApi({
      'GET /health': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    render(<App />);

    expect(await screen.findByText('Sem conexão')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('login leva ao construtor de planos e Sair volta ao login', async () => {
    fakeApi({ 'GET /health': health, 'POST /auth/login': () => loginResponse() });
    render(<App />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-forte-123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Dra. Ana')).toBeInTheDocument();
    expect(screen.getByText(/Construtor de planos alimentares/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prescrever plano' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(sessionStorage.getItem('nutrivision.session')).toBeNull();
  });

  it('restaura a sessao salva na aba', () => {
    fakeApi({ 'GET /health': health });
    sessionStorage.setItem(
      'nutrivision.session',
      JSON.stringify({
        token: 't',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        user: nutritionist,
      }),
    );

    render(<App />);

    expect(screen.getByText('Dra. Ana')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();
  });
});
