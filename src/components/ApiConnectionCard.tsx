type Status =
  { state: 'loading' } | { state: 'ok'; service: string } | { state: 'error'; message: string };

interface Props {
  status: Status;
  apiUrl: string;
}

const LABEL: Record<Status['state'], string> = {
  loading: 'Verificando…',
  ok: 'Conectado',
  error: 'Sem conexão',
};

export function ApiConnectionCard({ status, apiUrl }: Props) {
  return (
    <section className="card" aria-live="polite">
      <h2>Back-end</h2>
      <p>
        <span className={`dot dot--${status.state}`} aria-hidden="true" />
        {LABEL[status.state]}
      </p>
      <dl>
        <dt>API</dt>
        <dd>
          <code>{apiUrl}</code>
        </dd>
        {status.state === 'ok' && (
          <>
            <dt>Serviço</dt>
            <dd>{status.service}</dd>
          </>
        )}
        {status.state === 'error' && (
          <>
            <dt>Erro</dt>
            <dd>{status.message}</dd>
          </>
        )}
      </dl>
    </section>
  );
}
