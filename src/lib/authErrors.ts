import { ApiError } from '@/lib/api';

/** Lê `{"detail": "texto"}` (formato do FastAPI). Detalhes em lista não são exibidos. */
function readDetail(body: string): string | null {
  try {
    const data: unknown = JSON.parse(body);
    const detail = (data as { detail?: unknown } | null)?.detail;
    return typeof detail === 'string' ? detail : null;
  } catch {
    return null;
  }
}

/** Traduz um erro da API/rede em texto para o usuário. */
export function describeAuthError(error: unknown): string {
  // `fetch` rejeita com TypeError quando não consegue falar com o servidor.
  if (error instanceof TypeError) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }
  if (!(error instanceof ApiError)) return 'Algo deu errado. Tente novamente.';

  const { status } = error;
  if (status === 401) return 'E-mail ou senha incorretos.';
  if (status === 409) return readDetail(error.message) ?? 'Este e-mail já está cadastrado.';
  if (status === 400 || status === 422) {
    return readDetail(error.message) ?? 'Dados inválidos. Revise os campos e tente novamente.';
  }
  if (status >= 500)
    return 'O servidor está indisponível no momento. Tente novamente em instantes.';
  return readDetail(error.message) ?? 'Não foi possível concluir. Tente novamente.';
}
