import { useLocale } from '../locale/context';
import { historyText } from '../locale/historyCopy';
import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { EvidenceRetentionPanel } from './EvidenceRetentionPanel';
import { StructuredRetentionPanel } from './StructuredRetentionPanel';

interface RetentionSectionProps {
  token: string;
  onCleaned: () => void;
}

export function RetentionSection({ token, onCleaned }: RetentionSectionProps): React.JSX.Element {
  const { locale } = useLocale();
  const tr = (text: string) => historyText(locale, text);
  return (
    <section aria-labelledby="section-retention-title">
      <div style={{ marginBottom: '14px' }}>
        <h4 id="section-retention-title" style={{ color: 'var(--primary-accent)', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={16} /> {tr("Data retention policy")}
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '2px 0 0' }}>
          {tr("Inspect and run cleanup for raw evidence and completed records.")}
        </p>
      </div>

      <EvidenceRetentionPanel token={token} />
      <StructuredRetentionPanel token={token} onCleaned={onCleaned} />
    </section>
  );
}
