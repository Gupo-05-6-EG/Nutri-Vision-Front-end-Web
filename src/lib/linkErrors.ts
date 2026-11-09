import { ApiError } from '@/lib/api';

/** Lê `{"detail": "texto"}` (formato do FastAPI). */
function readDetail(body: string): string | null {
  try {
    const data: unknown = JSON.parse(body);
    const detail = (data as { detail?: unknown } | null)?.detail;
    return typeof detail === 'string' ? detail : null;
  } catch {
    return null;
  }
}

/** Traduz um erro da gestão de vínculos em texto para o nutricionista. */
export function describeLinkError(error: unknown): string {
  if (error instanceof TypeError) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }
  if (!(error instanceof ApiError)) return 'Algo deu errado. Tente novamente.';

  if (error.status === 404) return 'Vínculo não encontrado. Atualize a lista.';
  if (error.status >= 500) {
    return 'O servidor está indisponível no momento. Tente novamente em instantes.';
  }
  return readDetail(error.message) ?? 'Não foi possível concluir. Tente novamente.';
}
