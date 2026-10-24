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
      <div style={{ maxWidth: '480px', margin: '40px auto', textAlign: 'center', padding: '32px' }}>
        <Loader2 size={36} className="spin" color="#6366f1" style={{ margin: '0 auto 16px auto' }} />
        <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading order details / অর্ডার লোড হচ্ছে...</div>
      </div>
    );
  }

  if (gateDisabledMessage) {
    return (
      <div style={{ maxWidth: '480px', margin: '40px auto', padding: '0 16px' }}>
        <div className="card" style={{ border: '1px solid rgba(234, 179, 8, 0.4)', textAlign: 'center', padding: '24px' }}>
          <ShieldAlert size={40} color="#eab308" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#fef08a' }}>Public Access Disabled</h3>
          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
            {gateDisabledMessage}
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ maxWidth: '480px', margin: '40px auto', padding: '0 16px' }}>
        <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.4)', textAlign: 'center', padding: '24px' }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#fca5a5' }}>Unable to Load Order / অর্ডার দেখা যাচ্ছে না</h3>
          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '16px' }}>
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
    <div style={{ maxWidth: '480px', margin: '20px auto', padding: '0 16px 40px 16px' }}>
      <BuyerOrderDetails order={order} />
      {refreshError && <p role="alert">{refreshError}</p>}

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
    </div>
  );
}
