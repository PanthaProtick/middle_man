import React from 'react';
import type { PaymentAccount } from './types';

interface WorkspaceAccountsSummaryProps {
  accounts: PaymentAccount[];
  onManageAccounts: () => void;
}

export function WorkspaceAccountsSummary({
  accounts,
  onManageAccounts,
}: WorkspaceAccountsSummaryProps): React.JSX.Element {
  const activeAccounts = accounts.filter((a) => a.is_active);

  return (
    <div className="workspace-accounts-summary">
      <div className="accounts-summary-left">
        <span className="summary-label">Active Receiving Accounts:</span>
        <div className="summary-pills">
          {activeAccounts.map((a) => (
            <span key={a.id} className="summary-account-pill">
              <strong>{a.provider.toUpperCase()}</strong>: {a.label} ({a.receiving_number})
            </span>
          ))}
          {activeAccounts.length === 0 && (
            <span className="summary-account-empty">No active receiving accounts configured</span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={onManageAccounts}
      >
        Manage Accounts &rarr;
      </button>
    </div>
  );
}
