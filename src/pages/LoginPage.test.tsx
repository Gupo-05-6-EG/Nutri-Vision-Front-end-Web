import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '@/pages/LoginPage';
import { detail, fakeApi, loginResponse, nutritionist } from '@/test/fakeApi';

async function fillIn(email = 'ana@exemplo.com', password = 'senha-forte-123') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  return user;
}

describe('LoginPage', () => {
  it('so habilita Entrar com email e senha preenchidos', async () => {
    render(<LoginPage onLogin={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Entrar' });
    expect(button).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'ana@exemplo.com');
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('Senha'), 'x');
    expect(button).toBeEnabled();
  });

  it('entra e devolve a sessao do nutricionista', async () => {
    const { calls } = fakeApi({ 'POST /auth/login': () => loginResponse() });
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    const user = await fillIn();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await vi.waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    expect(onLogin.mock.calls[0][0]).toMatchObject({ token: 'token-da-ana', user: nutritionist });
    expect(calls[0].body).toEqual({ email: 'ana@exemplo.com', senha: 'senha-forte-123' });
  });

  it('Enter no campo de senha envia o formulario', async () => {
    fakeApi({ 'POST /auth/login': () => loginResponse() });
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    const user = await fillIn();
    await user.keyboard('{Enter}');

    await vi.waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
  });

  it('401 mostra mensagem amigavel', async () => {
    fakeApi({ 'POST /auth/login': () => detail('Email ou senha invalidos', 401) });
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    const user = await fillIn();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha inválidos.');
    expect(onLogin).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('paciente e barrado no painel', async () => {
    fakeApi({
      'POST /auth/login': () => loginResponse({ ...nutritionist, perfil: 'paciente' } as never),
    });
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    const user = await fillIn('paciente@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O painel é exclusivo para nutricionistas.',
    );
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('falha de rede mostra o erro e limpa ao tentar de novo', async () => {
    let fail = true;
    fakeApi({
      'POST /auth/login': () => {
        if (fail) throw new TypeError('Failed to fetch');
        return loginResponse();
      },
    });
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);

    const user = await fillIn();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await vi.waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mostra Entrando e desabilita o botao enquanto espera', async () => {
    let respond!: (r: Response) => void;
    fakeApi({ 'POST /auth/login': () => new Promise<Response>((resolve) => (respond = resolve)) });
    render(<LoginPage onLogin={vi.fn()} />);

    const user = await fillIn();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const waiting = await screen.findByRole('button', { name: 'Entrando…' });
    expect(waiting).toBeDisabled();
    respond(loginResponse());
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeEnabled();
  });
});
