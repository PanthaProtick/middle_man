import React from 'react';
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
  return (
    <div className="workspace-section-tabs" role="navigation" aria-label="Seller Desk Sections">
      <button
        type="button"
        
        aria-current={currentSection === 'orders' ? 'page' : undefined}
        className={`workspace-section-tab ${currentSection === 'orders' ? 'active' : ''}`}
        onClick={() => onSelectSection('orders')}
      >
        <ShoppingBag size={14} />
        <span>Orders &amp; Links</span>
        <span className="section-tab-count">{ordersCount}</span>
      </button>

      <button
        type="button"
        
        aria-current={currentSection === 'payments' ? 'page' : undefined}
        className={`workspace-section-tab ${currentSection === 'payments' ? 'active' : ''}`}
        onClick={() => onSelectSection('payments')}
      >
        <Smartphone size={14} />
        <span>Payments &amp; SMS</span>
        <span className="section-tab-count">{transactionsCount}</span>
      </button>

      <button
        type="button"
        
        aria-current={currentSection === 'accounts' ? 'page' : undefined}
        className={`workspace-section-tab ${currentSection === 'accounts' ? 'active' : ''}`}
        onClick={() => onSelectSection('accounts')}
      >
        <CreditCard size={14} />
        <span>Receiving Accounts</span>
        <span className="section-tab-count">{accountsCount}</span>
      </button>

      <button
        type="button"
        
        aria-current={currentSection === 'retention' ? 'page' : undefined}
        className={`workspace-section-tab ${currentSection === 'retention' ? 'active' : ''}`}
        onClick={() => onSelectSection('retention')}
      >
        <ShieldCheck size={14} />
        <span>Data Retention</span>
      </button>
    </div>
  );
}
