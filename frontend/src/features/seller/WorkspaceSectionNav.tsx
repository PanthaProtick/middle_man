import React from 'react';
import { useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';
import { ShoppingBag, Smartphone, CreditCard, ShieldCheck } from 'lucide-react';
import type { WorkspaceSection } from './SellerWorkspace';

interface WorkspaceSectionNavProps {
  currentSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  ordersCount: number;
  transactionsCount: number;
  accountsCount: number;
}

export function WorkspaceSectionNav({
  currentSection,
  onSelectSection,
  ordersCount,
  transactionsCount,
  accountsCount,
}: WorkspaceSectionNavProps): React.JSX.Element {
  const text = sellerCopy[useLocale().locale];
  return (
    <div className="workspace-section-tabs" role="navigation" aria-label={text.sections}>
      <button
        type="button"
        
        aria-current={currentSection === 'orders' ? 'page' : undefined}
        className={`workspace-section-tab ${currentSection === 'orders' ? 'active' : ''}`}
        onClick={() => onSelectSection('orders')}
      >
        <ShoppingBag size={14} />
        <span>{text.orders}</span>
        {ordersCount > 0 && <span className="section-tab-count" aria-label={`${ordersCount} ${text.newEntries}`}>{ordersCount}</span>}
      </button>

      <button
        type="button"
        
        aria-current={currentSection === 'payments' ? 'page' : undefined}
        className={`workspace-section-tab ${currentSection === 'payments' ? 'active' : ''}`}
        onClick={() => onSelectSection('payments')}
      >
        <Smartphone size={14} />
        <span>{text.payments}</span>
        {transactionsCount > 0 && <span className="section-tab-count" aria-label={`${transactionsCount} ${text.newEntries}`}>{transactionsCount}</span>}
      </button>

      <button
        type="button"
        
        aria-current={currentSection === 'accounts' ? 'page' : undefined}
        className={`workspace-section-tab ${currentSection === 'accounts' ? 'active' : ''}`}
        onClick={() => onSelectSection('accounts')}
      >
        <CreditCard size={14} />
        <span>{text.accounts}</span>
        {accountsCount > 0 && <span className="section-tab-count" aria-label={`${accountsCount} ${text.newEntries}`}>{accountsCount}</span>}
      </button>

      <button
        type="button"
        
        aria-current={currentSection === 'retention' ? 'page' : undefined}
        className={`workspace-section-tab ${currentSection === 'retention' ? 'active' : ''}`}
        onClick={() => onSelectSection('retention')}
      >
        <ShieldCheck size={14} />
        <span>{text.retention}</span>
      </button>
    </div>
  );
}
