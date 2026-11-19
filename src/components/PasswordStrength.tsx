/** Medidor de força da senha do cadastro (protótipo). Só orienta: quem barra é o validador. */

export type Strength = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(password: string): Strength {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(1, Math.min(4, score)) as Strength;
}

const LABELS = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'];

export function PasswordStrength({ password }: { password: string }) {
  const strength = passwordStrength(password);
  if (strength === 0) return null;
  return (
    <div className={`strength strength--${strength}`} aria-live="polite">
      <div className="strength__bars" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <span key={level} className={level <= strength ? 'strength__bar--on' : undefined} />
        ))}
      </div>
      <small>Força da senha: {LABELS[strength]}</small>
    </div>
  );
}
