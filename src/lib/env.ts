/**
 * Leitura centralizada das variáveis de ambiente.
 *
 * Falhar cedo (e com mensagem clara) é melhor do que descobrir em runtime que
 * `VITE_API_URL` estava vazio e a API foi chamada em `undefined/...`.
 */

function required(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não definida. Copie .env.example para .env.local.`,
    );
  }
  return value;
}

export const env = {
  apiUrl: required('VITE_API_URL'),
  appName: import.meta.env.VITE_APP_NAME ?? 'Nutri Vision',
  environment: import.meta.env.VITE_ENVIRONMENT ?? 'development',
} as const;
