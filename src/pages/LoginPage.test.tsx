import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { useAuth } from '@/auth/useAuth';
import { LoginPage } from '@/pages/LoginPage';
import App from '@/App';
import { detail, fakeApi, fakeJwt, json, loginResponse, nutritionist } from '@/test/fakeApi';

function Status() {
  return <span data-testid="status">{useAuth().status}</span>;
}

function renderLogin(onGoToRegister = vi.fn()) {
  render(
    <AuthProvider>
      <Status />
      <LoginPage onGoToRegister={onGoToRegister} />
    </AuthProvider>,
  );
  return { onGoToRegister, user: userEvent.setup() };
}

const email = () => screen.getByLabelText('E-mail profissional');
const password = () => screen.getByLabelText('Senha de acesso');
const submit = () => screen.getByRole('button', { name: 'Entrar no painel clínico' });

describe('LoginPage', () => {
  it('valida os campos antes de chamar a API', async () => {
    const { calls } = fakeApi({});
    const { user } = renderLogin();

    await user.click(submit());
    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument();
    expect(email()).toHaveAttribute('aria-invalid', 'true');

    await user.type(email(), 'ana@exemplo');
    await user.click(submit());
    expect(screen.getByText('E-mail inválido.')).toBeInTheDocument();

    expect(calls).toHaveLength(0);
  });

  it('entra, guarda o token e abre a sessao', async () => {
    const { calls } = fakeApi({ 'POST /auth/login': () => loginResponse() });
    const { user } = renderLogin();

    await user.type(email(), '  ana@exemplo.com ');
    await user.type(password(), 'senha-forte-123');
    await user.click(submit());

    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    expect(calls[0].body).toEqual({ email: 'ana@exemplo.com', senha: 'senha-forte-123' });
    expect(localStorage.getItem('nutrivision.token')).toBe('token-da-ana');
  });

  it.each([
    [() => detail('Email ou senha invalidos', 401), 'E-mail ou senha incorretos.'],
    [() => new Response('', { status: 503 }), 'O servidor está indisponível'],
    [
      () => {
        throw new TypeError('Failed to fetch');
      },
      'Não foi possível conectar ao servidor',
    ],
  ])('mostra o erro da API (%#)', async (handler, message) => {
    fakeApi({ 'POST /auth/login': handler });
    const { user } = renderLogin();

    await user.type(email(), 'ana@exemplo.com');
    await user.type(password(), 'x');
    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(submit()).toBeEnabled();
  });

  it('desabilita o botao enquanto entra', async () => {
    let respond!: (response: Response) => void;
    const { calls } = fakeApi({
      'POST /auth/login': () => new Promise<Response>((resolve) => (respond = resolve)),
    });
    const { user } = renderLogin();

    await user.type(email(), 'ana@exemplo.com');
    await user.type(password(), 'x');
    await user.click(submit());

    const button = screen.getByRole('button', { name: 'Entrando…' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(calls).toHaveLength(1);

    respond(loginResponse());
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
  });

  it('mostra o aviso quando a sessao salva expirou', () => {
    localStorage.setItem('nutrivision.token', fakeJwt(-1));
    renderLogin();

    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou.');
    expect(localStorage.getItem('nutrivision.token')).toBeNull();
  });

  it('mostra e oculta a senha', async () => {
    const { user } = renderLogin();

    expect(password()).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(password()).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(password()).toHaveAttribute('type', 'password');
  });

  it('leva para o cadastro', async () => {
    const { user, onGoToRegister } = renderLogin();
    await user.click(screen.getByRole('button', { name: 'Cadastre-se aqui' }));
    expect(onGoToRegister).toHaveBeenCalledOnce();
  });
});

describe('LoginPage - lembrar de mim', () => {
  it('sem lembrar, o token fica so na sessao do navegador', async () => {
    fakeApi({
      'POST /auth/login': () => loginResponse(),
      'GET /auth/me': () => json(nutritionist),
    });
    render(<App />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('E-mail profissional'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha de acesso'), 'senha-forte-123');
    await user.click(screen.getByLabelText('Lembrar de mim neste computador'));
    await user.click(screen.getByRole('button', { name: 'Entrar no painel clínico' }));

    await screen.findByRole('navigation', { name: 'Menu do painel' });
    expect(localStorage.getItem('nutrivision.token')).toBeNull();
    expect(sessionStorage.getItem('nutrivision.token')).toBe('token-da-ana');
  });

  it('tela de entrada apresenta o painel sem numeros inventados', () => {
    fakeApi({});
    render(<App />);

    expect(screen.getByRole('complementary', { name: 'Sobre o Nutri Vision' })).toBeInTheDocument();
    expect(screen.getByText('Registro por foto com IA')).toBeInTheDocument();
    expect(screen.queryByText(/esqueceu/i)).not.toBeInTheDocument();
  });
});
