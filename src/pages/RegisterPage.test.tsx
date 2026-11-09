import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { useAuth } from '@/auth/useAuth';
import { RegisterPage } from '@/pages/RegisterPage';
import { detail, fakeApi, json } from '@/test/fakeApi';

function Status() {
  return <span data-testid="status">{useAuth().status}</span>;
}

function renderRegister(onGoToLogin = vi.fn()) {
  render(
    <AuthProvider>
      <Status />
      <RegisterPage onGoToLogin={onGoToLogin} />
    </AuthProvider>,
  );
  return { onGoToLogin, user: userEvent.setup() };
}

const submit = () => screen.getByRole('button', { name: 'Criar conta de nutricionista' });

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nome completo'), ' Dra. Ana ');
  await user.type(screen.getByLabelText('E-mail profissional'), 'ana@exemplo.com');
  await user.selectOptions(screen.getByLabelText('Região federativa'), 'CRN-3');
  await user.type(screen.getByLabelText('Nº do registro'), '4289/P');
  await user.type(screen.getByLabelText('Senha de acesso'), 'senha-forte-123');
  await user.type(screen.getByLabelText('Confirmar senha'), 'senha-forte-123');
  await user.click(screen.getByRole('checkbox'));
}

describe('RegisterPage', () => {
  it('aponta todos os campos obrigatorios sem chamar a API', async () => {
    const { calls } = fakeApi({});
    const { user } = renderRegister();

    await user.click(submit());

    for (const message of [
      'Informe seu nome completo.',
      'Informe seu e-mail.',
      'Selecione a região.',
      'Informe o número do registro.',
      'Crie uma senha.',
      'Repita a senha.',
      'Aceite os Termos de Serviço e a Política de Privacidade para continuar.',
    ]) {
      expect(screen.getByText(message)).toBeInTheDocument();
    }
    expect(calls).toHaveLength(0);
  });

  it('senhas diferentes e senha curta', async () => {
    fakeApi({});
    const { user } = renderRegister();

    await user.type(screen.getByLabelText('Senha de acesso'), '1234567');
    await user.type(screen.getByLabelText('Confirmar senha'), '7654321');
    await user.click(submit());

    expect(screen.getByText('A senha deve ter no mínimo 8 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('As senhas não conferem.')).toBeInTheDocument();
  });

  it('cadastra com o CRN montado e ja entra', async () => {
    const { calls } = fakeApi({
      'POST /auth/cadastro/nutricionista': () => json({ access_token: 'novo' }, 201),
    });
    const { user } = renderRegister();

    await fillValid(user);
    await user.click(submit());

    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    expect(calls[0].body).toEqual({
      nome: 'Dra. Ana',
      email: 'ana@exemplo.com',
      senha: 'senha-forte-123',
      crn: 'CRN-3 4289/P',
    });
    expect(localStorage.getItem('nutrivision.token')).toBe('novo');
  });

  it('email ja cadastrado mostra o detalhe da API', async () => {
    fakeApi({
      'POST /auth/cadastro/nutricionista': () => detail('Email ja cadastrado', 409),
    });
    const { user } = renderRegister();

    await fillValid(user);
    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ja cadastrado');
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(submit()).toBeEnabled();
  });

  it('volta para o login', async () => {
    const { user, onGoToLogin } = renderRegister();
    await user.click(screen.getByRole('button', { name: 'Fazer login' }));
    expect(onGoToLogin).toHaveBeenCalledOnce();
  });
});
