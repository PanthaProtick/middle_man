import React from 'react';
import { CreditCard } from 'lucide-react';
import { PaymentAccountList } from './PaymentAccountList';
import { AddAccountForm } from './AddAccountForm';
import { PathaoSettings } from './PathaoSettings';
import type { PaymentAccount } from './types';

interface AccountsSectionProps {
  accounts: PaymentAccount[];
  token: string;
  onAccountUpdated: (updated: PaymentAccount) => void;
  onAccountCreated: (created: PaymentAccount) => void;
  onError: (msg: string | null) => void;
  onReload: () => void;
}

export function AccountsSection({
  accounts,
  token,
  onAccountUpdated,
  onAccountCreated,
  onError,
  onReload,
}: AccountsSectionProps): React.JSX.Element {
  return (
    <section aria-labelledby="section-accounts-title">
      <div style={{ marginBottom: '14px' }}>
        <h4 id="section-accounts-title" style={{ color: 'var(--primary-accent)', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CreditCard size={16} /> Designated Receiving Accounts
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '2px 0 0' }}>
          Manage the bKash, Nagad, and Rocket numbers given to buyers on their confirmation link.
        </p>
      </div>

      <PaymentAccountList
        accounts={accounts}
        token={token}
        onAccountUpdated={onAccountUpdated}
        onError={onError}
        onReload={onReload}
      />

      <AddAccountForm
        token={token}
        onAccountCreated={onAccountCreated}
        onError={onError}
      />
      <PathaoSettings token={token} />
    </section>
  );
}
