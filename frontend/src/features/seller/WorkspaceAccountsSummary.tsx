import React from 'react';
import { useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';
import type { PaymentAccount } from './types';

interface WorkspaceAccountsSummaryProps {
  accounts: PaymentAccount[];
  onManageAccounts: () => void;
}

export function WorkspaceAccountsSummary({
  accounts,
  onManageAccounts,
}: WorkspaceAccountsSummaryProps): React.JSX.Element {
  const text = sellerCopy[useLocale().locale];
  const activeAccounts = accounts.filter((a) => a.is_active);

  return (
    <div className="workspace-accounts-summary">
      <div className="accounts-summary-left">
        <span className="summary-label">{text.activeAccounts}</span>
        <div className="summary-pills">
          {activeAccounts.map((a) => (
            <span key={a.id} className="summary-account-pill">
              <strong>{a.provider.toUpperCase()}</strong>: {a.label} ({a.receiving_number})
            </span>
          ))}
          {activeAccounts.length === 0 && (
            <span className="summary-account-empty">{text.noAccounts}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={onManageAccounts}
      >
        {text.manageAccounts} &rarr;
      </button>
    </div>
  );
}
