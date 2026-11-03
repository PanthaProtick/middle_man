import { useLocale } from '../locale/context';
import { historyText } from '../locale/historyCopy';
import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { EvidenceRetentionPanel } from './EvidenceRetentionPanel';
import { StructuredRetentionPanel } from './StructuredRetentionPanel';
import './Retention.css';

interface RetentionSectionProps {
  token: string;
  onCleaned: () => void;
}

export function RetentionSection({ token, onCleaned }: RetentionSectionProps): React.JSX.Element {
  const { locale } = useLocale();
  const tr = (text: string) => historyText(locale, text);
  return (
    <section aria-labelledby="section-retention-title">
      <div className="retention-section-header">
        <h4 id="section-retention-title" className="retention-title">
          <ShieldCheck size={18} aria-hidden="true" /> {tr("Data retention policy")}
        </h4>
        <p className="retention-desc">
          {tr("Inspect and run cleanup for raw evidence and completed records.")}
        </p>
      </div>

      <EvidenceRetentionPanel token={token} />
      <StructuredRetentionPanel token={token} onCleaned={onCleaned} />
    </section>
  );
}
