import { useLocale } from '../locale/context';
import { formatBangladeshDateTime, formatBdt, formatCount } from '../locale/format';
import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import type { TransactionObservation as Observation } from './types';
import { observationTone, stateLabel } from './transactionPresentation';
import './TransactionObservation.css';

interface TransactionObservationProps {
  observation: Observation;
  index: number;
  showSystemDetails: boolean;
}

export function TransactionObservation({
  observation: obs,
  index,
  showSystemDetails,
}: TransactionObservationProps): React.JSX.Element {
  const c = usePaymentInboxCopy();
  const { locale } = useLocale();
  const tone = observationTone(obs.conflict_state);
  const source = locale === 'en' ? obs.source.toUpperCase() : c(obs.source);

  return (
    <article className="transaction-observation" data-tone={tone}>
      <div className="transaction-observation-head">
        <h6 className="transaction-observation-title">
          {c("Observation #")}{formatCount(index + 1)} ({source})
        </h6>
        <span className="transaction-observation-state" data-tone={tone}>
          {c("Status:")} {stateLabel(c, obs.conflict_state)}
        </span>
      </div>
      <dl className="transaction-observation-facts">
        <div>
          <dt>{c("Amount:")}</dt>
          <dd>{formatBdt(obs.amount_minor)}</dd>
        </div>
        <div>
          <dt>{c("Sender:")}</dt>
          <dd>
            {obs.sender_number_canonical
              ? obs.sender_number_canonical
              : <span className="transaction-missing">{c("Unknown")}</span>}
          </dd>
        </div>
        <div>
          <dt>{c("Time:")}</dt>
          <dd>
            {obs.occurred_at
              ? formatBangladeshDateTime(obs.occurred_at, locale)
              : <span className="transaction-missing">{c("Unknown")}</span>}
          </dd>
        </div>
        <div>
          <dt>{c("Recorded:")}</dt>
          <dd>{formatBangladeshDateTime(obs.created_at, locale)}</dd>
        </div>
      </dl>
      {showSystemDetails && (
        <p className="transaction-observation-actor">{c("Actor:")} {obs.actor}</p>
      )}
    </article>
  );
}
