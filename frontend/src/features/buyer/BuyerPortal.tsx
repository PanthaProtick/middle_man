import React, { useState } from 'react';
import { Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import type { BuyerFormDraft } from './types';
import { usePublicOrder, type PublicOrderProblem } from './usePublicOrder';
import { BuyerOrderDetails } from './BuyerOrderDetails';
import { BuyerSubmissionForm } from './BuyerSubmissionForm';
import { BuyerStatusView } from './BuyerStatusView';
import { useBuyerSubmission } from './useBuyerSubmission';
import { useLocale, type MessageKey } from '../locale';

interface BuyerPortalProps {
  portalToken: string;
}

const PROBLEM_MESSAGES: Record<PublicOrderProblem, MessageKey> = {
  offline: 'buyer.errors.offline',
  refresh_failed: 'buyer.errors.refreshFailed',
  order_unavailable: 'buyer.errors.orderUnavailable',
  load_failed: 'buyer.errors.loadFailed',
};

export function BuyerPortal({ portalToken }: BuyerPortalProps): React.JSX.Element {
  return <BuyerPortalSession key={portalToken} portalToken={portalToken} />;
}

function BuyerPortalSession({ portalToken }: BuyerPortalProps): React.JSX.Element {
  const { t } = useLocale();
  const { order, loading, error, gateDisabled, isRefreshing, refreshError, refresh, save } = usePublicOrder(portalToken);

  const [editedDraft, setDraft] = useState<BuyerFormDraft | null>(null);
  const draft: BuyerFormDraft = editedDraft ?? {
    buyer_name: '',
    contact_number: '',
    address_raw: '',
    payment_provider: order?.account_provider === 'nagad' ? 'nagad' : 'bkash',
    payment_sender: '',
    payment_trx_id: '',
    claimed_advance_bdt: order ? (order.required_advance_minor / 100).toString() : '',
  };

  const { handleSubmit, isSubmitting, isLocked, submissionError, serverFields } = useBuyerSubmission(portalToken, save);

  if (loading) {
    return (
      <div className="portal-loading" role="status">
        <Loader2 size={36} className="spin" color="var(--primary-accent)" aria-hidden="true" />
        <div>{t('buyer.loading')}</div>
      </div>
    );
  }

  if (gateDisabled) {
    return (
      <div className="portal-notice portal-notice--warning" role="alert">
        <ShieldAlert size={24} color="var(--amber-accent)" aria-hidden="true" />
        <div>
          <h2 style={{ margin: '0 0 4px', color: 'var(--amber-accent)', fontSize: '1.05rem' }}>
            {t('buyer.gate.title')}
          </h2>
          <p style={{ margin: 0, lineHeight: 1.5 }}>{t('buyer.gate.body')}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="portal-notice portal-notice--error" role="alert">
        <AlertCircle size={24} color="var(--rose-accent)" aria-hidden="true" />
        <div>
          <h2 style={{ margin: '0 0 4px', color: 'var(--rose-accent)', fontSize: '1.05rem' }}>
            {t('buyer.loadError.title')}
          </h2>
          <p style={{ margin: '0 0 14px', lineHeight: 1.5 }}>
            {t(error ? PROBLEM_MESSAGES[error] : 'buyer.errors.loadFailed')}
          </p>
          <button type="button" onClick={refresh} disabled={isRefreshing} className="btn btn-secondary">
            {t('buyer.loadError.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="portal-main">
      <BuyerOrderDetails order={order} />
      {refreshError && (
        <div className="portal-notice portal-notice--error" role="alert">
          {t(PROBLEM_MESSAGES[refreshError])}
        </div>
      )}

      {order.lifecycle === 'awaiting_buyer' ? (
        <BuyerSubmissionForm
          portalToken={portalToken}
          order={order}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          isLocked={isLocked}
          serverFields={serverFields}
          submissionError={submissionError}
        />
      ) : (
        <BuyerStatusView order={order} onRefresh={refresh} isRefreshing={isRefreshing} />
      )}
    </main>
  );
}
