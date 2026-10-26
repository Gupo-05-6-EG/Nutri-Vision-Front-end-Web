import { useState } from 'react';
import { type Session, login } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { describeError } from '@/lib/plans';

interface Props {
  onLogin: (session: Session) => void;
}

export function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      onLogin(await login(email, password));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Email ou senha inválidos.'
          : describeError(err),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="card login" onSubmit={submit} noValidate>
      <h2>Entrar</h2>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Senha</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primary-button" disabled={sending || !email || !password}>
        {sending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
