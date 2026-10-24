import React, { useEffect, useState } from 'react';
import { Image, Loader2, AlertCircle, FileQuestion, ExternalLink } from 'lucide-react';
import { fetchHistory } from './corrections';

interface EvidenceViewerProps {
  orderId: string;
  token?: string;
  buyerRevision?: number;
}

export function EvidenceViewer({ orderId, token, buyerRevision }: EvidenceViewerProps): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    async function loadEvidence() {
      setLoading(true);
      setErrorMessage(null);
      setIsUnavailable(false);

      try {
        const history = await fetchHistory(orderId, token || '');
        const activeRevision = buyerRevision
          ? history.items.find((r) => r.revision_number === buyerRevision) || history.items[history.items.length - 1]
          : history.items[history.items.length - 1];
        const evId = activeRevision?.payment_claim?.evidence_id;

        if (!active) return;
        if (!evId) {
          setEvidenceId(null);
          setLoading(false);
          return;
        }

        setEvidenceId(evId);

        const res = await fetch(`/api/seller/evidence/${encodeURIComponent(evId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!active) return;

        if (res.status === 410 || res.status === 404) {
          setIsUnavailable(true);
        } else if (!res.ok) {
          setErrorMessage('Unable to load payment screenshot');
        } else {
          const blob = await res.blob();
          if (!active) return;
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
        }
      } catch {
        if (active) {
          setErrorMessage('Failed to check payment evidence');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadEvidence();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [orderId, token, buyerRevision]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px',
          background: 'var(--bg-surface)',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          marginBottom: '16px',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
        }}
      >
        <Loader2 size={16} className="spin" />
        <span>Checking payment evidence / স্ক্রিনশট যাচাই করা হচ্ছে...</span>
      </div>
    );
  }

  if (!evidenceId) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px',
          background: 'var(--bg-surface)',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          marginBottom: '16px',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
        }}
      >
        <FileQuestion size={16} color="var(--text-secondary)" />
        <span>No screenshot attached (buyer submitted manually) / কোনো স্ক্রিনশট যুক্ত করা হয়নি</span>
      </div>
    );
  }

  if (isUnavailable) {
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px',
          background: 'rgba(234, 179, 8, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          marginBottom: '16px',
          fontSize: '0.8rem',
          color: 'var(--amber-accent)',
        }}
      >
        <AlertCircle size={16} color="var(--amber-accent)" />
        <span>
          Evidence unavailable: raw copy was deleted or expired after 30 days / স্ক্রিনশট আর পাওয়া যাচ্ছে না (মেয়াদ শেষ বা মুছে ফেলা হয়েছে)
        </span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          marginBottom: '16px',
          fontSize: '0.8rem',
          color: 'var(--rose-accent)',
        }}
      >
        <AlertCircle size={16} color="var(--rose-accent)" />
        <span>{errorMessage}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '12px',
        background: 'var(--bg-surface)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--primary-accent)' }}>
          <Image size={15} color="var(--primary-accent)" />
          <span>Payment Screenshot Evidence / পেমেন্ট স্ক্রিনশট</span>
        </div>
        {blobUrl && (
          <a
            href={blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              color: 'var(--cyan-accent)',
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={12} />
            <span>Open Full Size</span>
          </a>
        )}
      </div>

      {blobUrl && (
        <div style={{ textAlign: 'center', marginTop: '6px' }}>
          <img
            src={blobUrl}
            alt="Payment screenshot evidence"
            style={{
              maxWidth: '100%',
              maxHeight: '260px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              objectFit: 'contain',
            }}
          />
        </div>
      )}
    </div>
  );
}
