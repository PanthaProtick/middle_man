import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { EvidenceRetentionPanel } from './EvidenceRetentionPanel';
import { StructuredRetentionPanel } from './StructuredRetentionPanel';

interface RetentionSectionProps {
  token: string;
  onCleaned: () => void;
}

export function RetentionSection({ token, onCleaned }: RetentionSectionProps): React.JSX.Element {
  return (
    <section aria-labelledby="section-retention-title">
      <div style={{ marginBottom: '14px' }}>
        <h4 id="section-retention-title" style={{ color: 'var(--primary-accent)', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={16} /> Data Retention &amp; Compliance Policy
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '2px 0 0' }}>
          Inspect and execute statutory retention routines for raw evidence files and operational history.
        </p>
      </div>

      <EvidenceRetentionPanel token={token} />
      <StructuredRetentionPanel token={token} onCleaned={onCleaned} />
    </section>
  );
}
