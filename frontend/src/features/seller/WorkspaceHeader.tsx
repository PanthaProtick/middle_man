import React from 'react';
import { useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';
import { Store, Smartphone, Plus, RefreshCw } from 'lucide-react';

interface WorkspaceHeaderProps {
  displayTitle: string;
  setupNeeded: boolean;
  onOpenRecordModal: () => void;
  onOpenCreateModal: () => void;
  onRefresh: () => void;
}

export function WorkspaceHeader({
  displayTitle,
  setupNeeded,
  onOpenRecordModal,
  onOpenCreateModal,
  onRefresh,
}: WorkspaceHeaderProps): React.JSX.Element {
  const text = sellerCopy[useLocale().locale];
  return (
    <div className="card-header">
      <div>
        <div className="card-title">
          <Store size={22} color="var(--primary-accent)" />
          <span>{displayTitle}</span>
        </div>
        <p className="card-subtitle">
          {setupNeeded
            ? text.setupHelp
            : text.workspaceHelp}
        </p>
      </div>
      {!setupNeeded && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={onOpenRecordModal}>
            <Smartphone size={14} /> {text.record}
          </button>
          <button className="btn btn-primary btn-sm" onClick={onOpenCreateModal}>
            <Plus size={14} /> {text.createLink}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
            <RefreshCw size={14} /> {text.refresh}
          </button>
        </div>
      )}
    </div>
  );
}
