import React, { useState } from 'react';
import { Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import type { BuyerFormDraft } from './types';
import { usePublicOrder } from './usePublicOrder';
import { BuyerOrderDetails } from './BuyerOrderDetails';
import { BuyerSubmissionForm } from './BuyerSubmissionForm';
import { BuyerStatusView } from './BuyerStatusView';
import { useBuyerSubmission } from './useBuyerSubmission';

interface BuyerPortalProps {
  portalToken: string;
}

export function BuyerPortal({ portalToken }: BuyerPortalProps): React.JSX.Element {
  return <BuyerPortalSession key={portalToken} portalToken={portalToken} />;
}

function BuyerPortalSession({ portalToken }: BuyerPortalProps): React.JSX.Element {
  const { order, loading, error, gateDisabledMessage, isRefreshing, refreshError, refresh, save } = usePublicOrder(portalToken);

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
        <Loader2 size={36} className="spin" color="#818cf8" aria-hidden="true" />
        <div>Loading order details / অর্ডার লোড হচ্ছে...</div>
      </div>
    );
  }

  if (gateDisabledMessage) {
    return (
      <div className="portal-notice portal-notice--warning" role="alert">
        <ShieldAlert size={24} color="#facc15" aria-hidden="true" />
        <div>
          <h2 style={{ margin: '0 0 4px', color: '#fef08a', fontSize: '1.05rem' }}>Public Access Disabled</h2>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            {gateDisabledMessage}
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="portal-notice portal-notice--error" role="alert">
        <AlertCircle size={24} color="#fb7185" aria-hidden="true" />
        <div>
          <h2 style={{ margin: '0 0 4px', color: '#fecdd3', fontSize: '1.05rem' }}>Unable to Load Order / অর্ডার দেখা যাচ্ছে না</h2>
          <p style={{ margin: '0 0 14px', lineHeight: 1.5 }}>
            {error || 'The requested order could not be loaded.'}
          </p>
          <button type="button" onClick={refresh} disabled={isRefreshing} className="btn btn-secondary">
            Retry / পুনরায় চেষ্টা করুন
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="portal-main">
      <BuyerOrderDetails order={order} />
      {refreshError && <div className="portal-notice portal-notice--error" role="alert">{refreshError}</div>}

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
