import { useState, type SubmitEvent } from 'react';
import { useAuth } from '@/auth/useAuth';
import { AuthLayout } from '@/components/AuthLayout';
import { FormAlert } from '@/components/FormAlert';
import { SelectField } from '@/components/SelectField';
import { PasswordStrength } from '@/components/PasswordStrength';
import { PasswordField, TextField } from '@/components/TextField';
import { describeAuthError } from '@/lib/authErrors';
import {
  CRN_REGIONS,
  validateCrnNumber,
  validateCrnRegion,
  validateEmail,
  validateName,
  validateNewPassword,
  validatePasswordConfirmation,
} from '@/lib/validators';

interface Props {
  onGoToLogin: () => void;
}

type Errors = Partial<
  Record<'name' | 'email' | 'region' | 'crnNumber' | 'password' | 'confirmation' | 'terms', string>
>;

export function RegisterPage({ onGoToLogin }: Props) {
  const { registerNutritionist } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState('');
  const [crnNumber, setCrnNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Errors = {
      name: validateName(name),
      email: validateEmail(email),
      region: validateCrnRegion(region),
      crnNumber: validateCrnNumber(crnNumber),
      password: validateNewPassword(password),
      confirmation: validatePasswordConfirmation(password, confirmation),
      terms: acceptedTerms
        ? undefined
        : 'Aceite os Termos de Serviço e a Política de Privacidade para continuar.',
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await registerNutritionist({
        name: name.trim(),
        email: email.trim(),
        password,
        crn: `${region} ${crnNumber.trim()}`,
      });
    } catch (error) {
      setFormError(describeAuthError(error));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Crie a sua conta profissional"
      subtitle="Faça a gestão dos seus pacientes e dietas em tempo real com validação do conselho de classe."
    >
      {formError && <FormAlert message={formError} />}

      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Nome completo"
          autoComplete="name"
          placeholder="Ex: Dra. Camila Mendes"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
        />
        <TextField
          label="E-mail profissional"
          type="email"
          autoComplete="username"
          placeholder="camila.mendes@clinica.com.br"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <div className="auth__grid">
          <SelectField
            label="Região federativa"
            placeholder="Selecione a região"
            options={CRN_REGIONS}
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            error={errors.region}
          />
          <TextField
            label="Nº do registro"
            inputMode="text"
            placeholder="Ex: 4289/P"
            value={crnNumber}
            onChange={(event) => setCrnNumber(event.target.value)}
            error={errors.crnNumber}
          />
        </div>
        <div className="auth__grid">
          <PasswordField
            label="Senha de acesso"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />
          <PasswordStrength password={password} />
          <PasswordField
            label="Confirmar senha"
            autoComplete="new-password"
            placeholder="Repita a senha"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            error={errors.confirmation}
          />
        </div>

        <div className="field">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={acceptedTerms}
              aria-invalid={errors.terms ? true : undefined}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            <span>
              Concordo com os Termos de Serviço e com a Política de Privacidade e Tratamento de
              Dados Clínicos, em conformidade com a LGPD (Lei nº 13.709/2018).
            </span>
          </label>
          {errors.terms && <p className="field__error">{errors.terms}</p>}
        </div>

        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Criando conta…' : 'Criar conta de nutricionista'}
        </button>
      </form>

      <p className="auth__switch">
        Já possui cadastro ativo?{' '}
        <button type="button" className="link" onClick={onGoToLogin}>
          Fazer login
        </button>
      </p>
    </AuthLayout>
  );
}
