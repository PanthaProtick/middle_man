import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import React from 'react';
import { CreditCard, Truck } from 'lucide-react';
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
  const c = usePaymentInboxCopy();
  return (
    <section aria-labelledby="section-accounts-title">
      <div className="isolated-section">
        <div className="isolated-section-header">
          <div>
            <h4 id="section-accounts-title" className="isolated-section-title">
              <CreditCard size={18} /> {c("Designated Receiving Accounts")}
            </h4>
            <p className="isolated-section-desc">
              {c("Manage the bKash, Nagad, and Rocket numbers given to buyers on their confirmation link.")}
            </p>
          </div>
          <span className="section-tab-count" style={{ alignSelf: 'center', fontSize: '0.78rem', padding: '3px 8px' }}>
            {accounts.length} {accounts.length === 1 ? c("account") : c("accounts")}
          </span>
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
      </div>

      <div className="isolated-section">
        <div className="isolated-section-header" style={{ marginBottom: '12px' }}>
          <div>
            <h4 className="isolated-section-title">
              <Truck size={18} /> Courier Logistics Integration
            </h4>
            <p className="isolated-section-desc">
              Connect your courier accounts to automate parcel dispatch and delivery tracking.
            </p>
          </div>
        </div>
        <PathaoSettings token={token} />
      </div>
    </section>
  );
}
