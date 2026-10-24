import React from 'react';
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
  return (
    <div className="card-header">
      <div>
        <div className="card-title">
          <Store size={22} color="var(--primary-accent)" />
          <span>{displayTitle}</span>
        </div>
        <p className="card-subtitle">
          {setupNeeded
            ? 'Start with your shop name. Next, add the account where buyers send their advance.'
            : 'Your orders, buyer details, and received advances — together in one place.'}
        </p>
      </div>
      {!setupNeeded && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={onOpenRecordModal}>
            <Smartphone size={14} /> Record Payment
          </button>
          <button className="btn btn-primary btn-sm" onClick={onOpenCreateModal}>
            <Plus size={14} /> Create Order Link
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      )}
    </div>
  );
}
