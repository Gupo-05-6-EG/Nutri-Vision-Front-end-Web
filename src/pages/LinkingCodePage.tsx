import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface LinkingCodeResponse {
  codigo: string;
  expira_em: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const body = JSON.parse(error.message) as { detail?: unknown };
      if (typeof body.detail === 'string') return body.detail;
    } catch {
      // Usa a mensagem original quando a resposta nao for JSON.
    }
    return error.message;
  }
  return 'Nao foi possivel concluir. Tente novamente.';
}

export function LinkingCodePage() {
  const [linkingCode, setLinkingCode] = useState<LinkingCodeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  const generateCode = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<LinkingCodeResponse>('/linking-code', {});
      setLinkingCode(result);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void generateCode();
  }, [generateCode]);

  return (
    <section className="card linking-code-card" aria-live="polite">
      <h2>Codigo de vinculacao</h2>
      <p className="muted">
        Compartilhe este codigo com seu paciente para iniciar o acompanhamento.
      </p>
      {linkingCode ? (
        <>
          <p className="link-code" aria-label={`Codigo ${linkingCode.codigo}`}>
            {linkingCode.codigo}
          </p>
          <p className="muted">
            Valido ate {new Date(linkingCode.expira_em).toLocaleString('pt-BR')}.
          </p>
        </>
      ) : !error ? (
        <p className="muted">Gerando codigo...</p>
      ) : null}
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="button button--secondary"
        onClick={generateCode}
        disabled={loading}
      >
        {loading ? 'Gerando...' : linkingCode ? 'Gerar novo codigo' : 'Tentar novamente'}
      </button>
    </section>
  );
}
