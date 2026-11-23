/**
 * Sino da barra superior (protótipo): alertas de desvio não lidos e vínculos
 * aguardando o aceite do paciente. É só dentro do painel (sem push), e atualiza
 * ao abrir e a cada minuto.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import {
  formatDirectionLabel,
  listDeviationAlerts,
  markDeviationAlertAsRead,
} from '@/lib/deviationAlertsApi';
import { formatNumber, getOverview } from '@/lib/portfolioApi';
import type { MonitoredPatient } from '@/lib/portfolioApi';
import type { DeviationAlert } from '@/types/deviationAlerts';

export const REFRESH_MS = 60_000;

interface Props {
  onOpenPatient: (patientId: number) => void;
}

export function NotificationBell({ onOpenPatient }: Props) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<DeviationAlert[]>([]);
  const [pending, setPending] = useState<MonitoredPatient[]>([]);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [alertList, overview] = await Promise.allSettled([
      listDeviationAlerts({ unreadOnly: true }),
      getOverview({ status: 'pendentes', porPagina: 20 }),
    ]);
    if (alertList.status === 'fulfilled') setAlerts(alertList.value);
    if (overview.status === 'fulfilled') setPending(overview.value.pacientes);
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function markRead(alert: DeviationAlert) {
    try {
      await markDeviationAlertAsRead(alert.id);
      setAlerts((current) => current.filter((item) => item.id !== alert.id));
    } catch {
      // Fica na lista: a próxima atualização tenta de novo.
    }
  }

  const count = alerts.length + pending.length;
  return (
    <div className="bell" ref={box}>
      <button
        type="button"
        className="bell__button"
        aria-label={count ? `Notificações: ${count} novas` : 'Notificações'}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load();
        }}
      >
        <Icon name="bell" />
        {count ? <span className="bell__badge">{count > 9 ? '9+' : count}</span> : null}
      </button>
      {open ? (
        <div className="bell__panel" role="region" aria-label="Notificações">
          <h2 className="bell__title">Notificações</h2>
          {count === 0 ? <p className="muted">Nada novo por aqui.</p> : null}
          <ul className="bell__list">
            {alerts.map((alert) => (
              <li key={`a${alert.id}`} className="bell__item">
                <span className="bell__icon bell__icon--warning">
                  <Icon name="alert" size={16} />
                </span>
                <button
                  type="button"
                  className="bell__text"
                  onClick={() => {
                    setOpen(false);
                    onOpenPatient(alert.paciente_id);
                  }}
                >
                  <strong>{alert.paciente_nome}</strong>
                  <span>
                    {formatDirectionLabel(alert.direcao)}: desvio médio de{' '}
                    {formatNumber(alert.percentual_medio_desvio)}% por {alert.dias_consecutivos}{' '}
                    {alert.dias_consecutivos === 1 ? 'dia' : 'dias'}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Marcar alerta de ${alert.paciente_nome} como lido`}
                  onClick={() => void markRead(alert)}
                >
                  <Icon name="check" size={16} />
                </button>
              </li>
            ))}
            {pending.map((patient) => (
              <li key={`p${patient.paciente_id}`} className="bell__item">
                <span className="bell__icon">
                  <Icon name="userPlus" size={16} />
                </span>
                <button
                  type="button"
                  className="bell__text"
                  onClick={() => {
                    setOpen(false);
                    onOpenPatient(patient.paciente_id);
                  }}
                >
                  <strong>{patient.nome}</strong>
                  <span>Resgatou o seu código e ainda não aceitou o vínculo.</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
