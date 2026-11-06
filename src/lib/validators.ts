/** Validações dos formulários de login e cadastro. Devolvem a mensagem ou `undefined`. */

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CRN_NUMBER_PATTERN = /^\d{1,10}(\/[A-Za-z])?$/;

export const CRN_REGIONS = Array.from({ length: 11 }, (_, index) => `CRN-${index + 1}`);

export function validateName(value: string): string | undefined {
  return value.trim() ? undefined : 'Informe seu nome completo.';
}

export function validateEmail(value: string): string | undefined {
  const text = value.trim();
  if (!text) return 'Informe seu e-mail.';
  return EMAIL_PATTERN.test(text) ? undefined : 'E-mail inválido.';
}

/** Login: só exige preenchimento (a regra de tamanho vale na criação). */
export function validateLoginPassword(value: string): string | undefined {
  return value ? undefined : 'Informe sua senha.';
}

export function validateNewPassword(value: string): string | undefined {
  if (!value) return 'Crie uma senha.';
  return value.length >= 8 ? undefined : 'A senha deve ter no mínimo 8 caracteres.';
}

export function validatePasswordConfirmation(password: string, confirmation: string) {
  if (!confirmation) return 'Repita a senha.';
  return password === confirmation ? undefined : 'As senhas não conferem.';
}

export function validateCrnRegion(value: string): string | undefined {
  return CRN_REGIONS.includes(value) ? undefined : 'Selecione a região.';
}

export function validateCrnNumber(value: string): string | undefined {
  const text = value.trim();
  if (!text) return 'Informe o número do registro.';
  return CRN_NUMBER_PATTERN.test(text) ? undefined : 'Número de registro inválido.';
}
