/**
 * Painel de alertas e notificações de desvio significativo do plano (Task 5.4, RF10.2).
 *
 * Permite ao nutricionista configurar a regra do job diário (ex.: >20% acima ou
 * abaixo da meta por 3 dias consecutivos), disparar a verificação sob demanda,
 * visualizar alertas no painel e marcar notificações como lidas.
 */

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { FormAlert } from '@/components/FormAlert';
import {
  formatDirectionLabel,
  getDeviationRule,
  listDeviationAlerts,
  markDeviationAlertAsRead,
  processDeviationAlerts,
  saveDeviationRule,
  validateDeviationRule,
} from '@/lib/deviationAlertsApi';
import type { DeviationAlert } from '@/types/deviationAlerts';

const kcalFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function formatDateBr(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

export function DeviationAlertsPage() {
  const [percentText, setPercentText] = useState('20');
  const [daysText, setDaysText] = useState('3');
  const [ruleActive, setRuleActive] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{ percent?: string; days?: string }>({});

  const [alerts, setAlerts] = useState<DeviationAlert[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [readingId, setReadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = useCallback(async (onlyUnread: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const [rule, alertList] = await Promise.all([
        getDeviationRule(),
        listDeviationAlerts({ unreadOnly: onlyUnread }),
      ]);
      setPercentText(String(rule.percentual_desvio));
      setDaysText(String(rule.dias_consecutivos));
      setRuleActive(rule.ativo);
      setAlerts(alertList);
    } catch {
      setError('Não foi possível carregar os alertas de desvio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(unreadOnly);
  }, [loadData, unreadOnly]);

  async function handleSaveRule(event: FormEvent) {
    event.preventDefault();
    setStatusMessage(null);
    setError(null);

    const validation = validateDeviationRule(percentText, daysText);
    if (!validation.parsed) {
      setFieldErrors(validation);
      return;
    }
    setFieldErrors({});
    setSavingRule(true);

    try {
      const saved = await saveDeviationRule({
        percentual_desvio: validation.parsed.percent,
        dias_consecutivos: validation.parsed.days,
        ativo: ruleActive,
      });
      setPercentText(String(saved.percentual_desvio));
      setDaysText(String(saved.dias_consecutivos));
      setRuleActive(saved.ativo);
      setStatusMessage(
        `Regra atualizada: desvio >${pctFmt.format(saved.percentual_desvio)}% por ${saved.dias_consecutivos} dia(s) consecutivo(s).`,
      );
    } catch {
      setError('Não foi possível salvar a regra de alerta.');
    } finally {
      setSavingRule(false);
    }
  }

  async function handleProcessNow() {
    setProcessing(true);
    setStatusMessage(null);
    setError(null);
    try {
      const result = await processDeviationAlerts();
      const updated = await listDeviationAlerts({ unreadOnly });
      setAlerts(updated);
      setStatusMessage(
        result.alertas_gerados > 0
          ? `Verificação concluída: ${result.alertas_gerados} novo(s) alerta(s) gerado(s).`
          : 'Verificação concluída: nenhum novo desvio identificado hoje.',
      );
    } catch {
      setError('Não foi possível processar os alertas de desvio agora.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleMarkAsRead(alert: DeviationAlert) {
    setReadingId(alert.id);
    setError(null);
    try {
      const updated = await markDeviationAlertAsRead(alert.id);
      setAlerts((current) =>
        unreadOnly
          ? current.filter((item) => item.id !== updated.id)
          : current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setError('Não foi possível marcar o alerta como lido.');
    } finally {
      setReadingId(null);
    }
  }

  const unreadCount = alerts.filter((a) => !a.lido).length;

  return (
    <div className="deviation-alerts">
      {unreadCount > 0 && (
        <div className="deviation-banner" role="alert">
          <strong>Notificação clínica:</strong> você possui {unreadCount}{' '}
          {unreadCount === 1
            ? 'alerta de desvio significativo de meta não lido.'
            : 'alertas de desvio significativo de meta não lidos.'}
        </div>
      )}

      <section className="card" aria-labelledby="deviation-rule-title">
        <h2 id="deviation-rule-title">Regra configurável de alerta (Job diário)</h2>
        <p className="deviation-alerts__subtitle">
          Defina o desvio percentual em relação à meta calórica diária e o número de dias
          consecutivos para notificar o painel.
        </p>

        <form className="deviation-rule-form" onSubmit={(e) => void handleSaveRule(e)} noValidate>
          <div className="row">
            <label className="field">
              <span>Limite de desvio (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                step="0.5"
                value={percentText}
                aria-invalid={Boolean(fieldErrors.percent)}
                onChange={(event) => setPercentText(event.target.value)}
              />
              {fieldErrors.percent && <span className="field__error">{fieldErrors.percent}</span>}
            </label>

            <label className="field">
              <span>Dias consecutivos</span>
              <input
                type="number"
                min={1}
                max={30}
                step="1"
                value={daysText}
                aria-invalid={Boolean(fieldErrors.days)}
                onChange={(event) => setDaysText(event.target.value)}
              />
              {fieldErrors.days && <span className="field__error">{fieldErrors.days}</span>}
            </label>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={ruleActive}
              onChange={(event) => setRuleActive(event.target.checked)}
            />
            <span>Monitorar desvios automaticamente no job diário</span>
          </label>

          <div className="deviation-rule-form__actions">
            <button type="submit" className="primary-button" disabled={savingRule}>
              {savingRule ? 'Salvando…' : 'Salvar regra'}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={processing}
              onClick={() => void handleProcessNow()}
            >
              {processing ? 'Verificando…' : 'Verificar desvios agora'}
            </button>
          </div>
        </form>
      </section>

      {error && <FormAlert message={error} />}
      {statusMessage && (
        <p role="status" className="notice notice--ok">
          {statusMessage}
        </p>
      )}

      <section className="card" aria-labelledby="deviation-list-title">
        <div className="deviation-alerts__header">
          <h2 id="deviation-list-title">Alertas de desvio do plano</h2>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
            />
            <span>Apenas não lidos</span>
          </label>
        </div>

        {loading && <p className="patients__empty">Carregando alertas…</p>}

        {!loading && alerts.length === 0 && (
          <p className="patients__empty">
            Nenhum alerta de desvio significativo registrado para o filtro atual.
          </p>
        )}

        {!loading && alerts.length > 0 && (
          <ul className="deviation-list">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={alert.lido ? 'deviation-item' : 'deviation-item deviation-item--unread'}
              >
                <div className="deviation-item__main">
                  <div className="deviation-item__top">
                    <strong>{alert.paciente_nome}</strong>
                    <span className="deviation-badge deviation-badge--direction">
                      {formatDirectionLabel(alert.direcao)}
                    </span>
                    {!alert.lido && (
                      <span className="deviation-badge deviation-badge--unread">Novo</span>
                    )}
                  </div>
                  <p className="deviation-item__summary">
                    Consumo médio de{' '}
                    <strong>{kcalFmt.format(alert.consumo_medio_kcal)} kcal</strong> vs meta de{' '}
                    <strong>{kcalFmt.format(alert.meta_kcal)} kcal</strong> (desvio médio de{' '}
                    <strong>{pctFmt.format(alert.percentual_medio_desvio)}%</strong>, limite &gt;
                    {pctFmt.format(alert.percentual_limite)}%) por{' '}
                    <strong>{alert.dias_consecutivos} dias consecutivos</strong> até{' '}
                    {formatDateBr(alert.data_referencia)}.
                  </p>
                  <span className="deviation-item__meta">{alert.paciente_email}</span>
                </div>

                {!alert.lido && (
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={readingId === alert.id}
                    onClick={() => void handleMarkAsRead(alert)}
                  >
                    {readingId === alert.id ? 'Marcando…' : 'Marcar como lido'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
