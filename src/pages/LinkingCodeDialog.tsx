/**
 * Código de vinculação (Task 1.4) num diálogo: só é gerado quando o
 * nutricionista pede (antes nascia um código novo a cada carga do painel) e
 * vem também como QR Code, que o paciente escaneia no app.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';

interface LinkingCodeResponse {
  codigo: string;
  expira_em: string;
}

/** Conteúdo do QR: o app lê o `codigo` (e aceita só os 6 dígitos também). */
export function linkCodeUri(code: string): string {
  return `nutrivision://vinculo?codigo=${code}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const body = JSON.parse(error.message) as { detail?: unknown };
      if (typeof body.detail === 'string') return body.detail;
    } catch {
      // Usa a mensagem original quando a resposta não for JSON.
    }
    return error.message;
  }
  return 'Não foi possível concluir. Tente novamente.';
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LinkingCodeDialog({ open, onClose }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [code, setCode] = useState<LinkingCodeResponse | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<LinkingCodeResponse>('/linking-code', {});
      setCode(result);
      setQr(await QRCode.toDataURL(linkCodeUri(result.codigo), { margin: 1, width: 220 }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-code-title"
        className="dialog"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <div className="dialog__body" aria-live="polite">
          <div className="dialog__header">
            <h2 id="link-code-title">Código de vinculação</h2>
            <button
              ref={closeButton}
              type="button"
              className="icon-button"
              aria-label="Fechar"
              onClick={onClose}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <p className="muted">
            Compartilhe este código (ou o QR Code) com o seu paciente para iniciar o acompanhamento.
            No app, ele escolhe &ldquo;Tenho nutricionista&rdquo;.
          </p>
          {code ? (
            <>
              <p className="link-code" aria-label={`Código ${code.codigo}`}>
                {code.codigo}
              </p>
              {qr ? (
                <img className="link-qr" src={qr} alt={`QR Code do código ${code.codigo}`} />
              ) : null}
              <p className="muted">
                Válido até {new Date(code.expira_em).toLocaleString('pt-BR')}. Gerar um novo código
                invalida o anterior.
              </p>
            </>
          ) : null}
          {error ? (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className={code ? 'button button--secondary' : 'button button--vivid'}
            onClick={generate}
            disabled={loading}
          >
            <Icon name="qr" size={18} />
            {loading ? 'Gerando…' : code ? 'Gerar novo código' : 'Gerar código'}
          </button>
        </div>
      </div>
    </div>
  );
}
