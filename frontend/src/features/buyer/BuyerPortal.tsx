import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import type { BuyerFormDraft, BuyerSubmissionInput, PublicOrder } from './types';
import { BuyerApiError, fetchPublicOrder, submitBuyerDetails } from './api';
import { BuyerOrderDetails } from './BuyerOrderDetails';
import { BuyerSubmissionForm } from './BuyerSubmissionForm';
import { BuyerStatusView } from './BuyerStatusView';

interface BuyerPortalProps {
  portalToken: string;
}

export function BuyerPortal({ portalToken }: BuyerPortalProps): React.JSX.Element {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gateDisabledMessage, setGateDisabledMessage] = useState<string | null>(null);

  const [draft, setDraft] = useState<BuyerFormDraft>({
    buyer_name: '',
    contact_number: '',
    address_raw: '',
    payment_provider: 'bkash',
    payment_sender: '',
    payment_trx_id: '',
    claimed_advance_bdt: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Retain same idempotency key for retrying the same payload
  const idempotencyKeyRef = useRef<string | null>(null);

  const loadOrder = useCallback(() => {
    fetchPublicOrder(portalToken)
      .then((data) => {
        setOrder(data);
        setDraft((prev) => ({
          ...prev,
          payment_provider: (data.account_provider as 'bkash' | 'nagad') || 'bkash',
          claimed_advance_bdt: prev.claimed_advance_bdt || (data.required_advance_minor / 100).toString(),
        }));
        setError(null);
        setGateDisabledMessage(null);
      })
      .catch((err: unknown) => {
        if (err instanceof BuyerApiError && err.statusCode === 503) {
          setGateDisabledMessage(
            err.message || 'Public buyer access is disabled until access/projection policy is settled',
          );
        } else {
          setError(err instanceof Error ? err.message : 'Unable to load order details');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [portalToken]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const orderLifecycle = order?.lifecycle;

  // Polling every 30s when lifecycle is pending
  useEffect(() => {
    if (orderLifecycle !== 'pending') return;

    const interval = setInterval(() => {
      fetchPublicOrder(portalToken)
        .then((fresh) => {
          setOrder(fresh);
        })
        .catch(() => {
          // Silently ignore background polling glitches
        });
    }, 30000);

    return () => clearInterval(interval);
  }, [orderLifecycle, portalToken]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await fetchPublicOrder(portalToken);
      setOrder(fresh);
    } catch {
      // Ignored
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = async (submission: BuyerSubmissionInput) => {
    setIsSubmitting(true);
    setSubmissionError(null);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = 'buyer-sub-' + Math.random().toString(36).substring(2, 12) + '-' + Date.now();
    }
    try {
      const updated = await submitBuyerDetails(portalToken, submission, idempotencyKeyRef.current);
      setOrder(updated);
    } catch (err) {
      if (err instanceof BuyerApiError) {
        setSubmissionError(err.message);
      } else {
        setSubmissionError(err instanceof Error ? err.message : 'Submission failed. Please check connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <h3 style={{ margin: '0 0 8px 0', color: '#fca5a5' }}>Order Not Found / সমস্যা হয়েছে</h3>
          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '16px' }}>
            {error || 'The requested order could not be loaded.'}
          </p>
          <button type="button" onClick={loadOrder} className="btn btn-secondary">
            Retry / পুনরায় চেষ্টা করুন
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '480px', margin: '20px auto', padding: '0 16px 40px 16px' }}>
      <BuyerOrderDetails order={order} />

      {order.lifecycle === 'awaiting_buyer' ? (
        <BuyerSubmissionForm
          order={order}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submissionError={submissionError}
        />
      ) : (
        <BuyerStatusView order={order} onRefresh={handleManualRefresh} isRefreshing={isRefreshing} />
      )}
    </div>
  );
}
