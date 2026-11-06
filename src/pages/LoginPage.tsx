import { useState, type SubmitEvent } from 'react';
import { useAuth } from '@/auth/useAuth';
import { AuthLayout } from '@/components/AuthLayout';
import { FormAlert } from '@/components/FormAlert';
import { PasswordField, TextField } from '@/components/TextField';
import { describeAuthError } from '@/lib/authErrors';
import { validateEmail, validateLoginPassword } from '@/lib/validators';

interface Props {
  onGoToRegister: () => void;
}

export function LoginPage({ onGoToRegister }: Props) {
  const { login, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = {
      email: validateEmail(email),
      password: validateLoginPassword(password),
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await login(email.trim(), password);
    } catch (error) {
      setFormError(describeAuthError(error));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Acesse o seu painel profissional com as suas credenciais cadastradas."
    >
      {notice && <FormAlert tone="info" message={notice} />}
      {formError && <FormAlert message={formError} />}

      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="E-mail profissional"
          type="email"
          autoComplete="username"
          placeholder="dra.camila@nutrivision.com.br"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <PasswordField
          label="Senha de acesso"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar no painel clínico'}
        </button>
      </form>

      <p className="auth__switch">
        Ainda não tem conta profissional?{' '}
        <button type="button" className="link" onClick={onGoToRegister}>
          Cadastre-se aqui
        </button>
      </p>
    </AuthLayout>
  );
}
