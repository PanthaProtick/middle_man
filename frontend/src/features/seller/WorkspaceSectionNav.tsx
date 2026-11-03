import React from 'react';
import { useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';
import { ShoppingBag, Smartphone, CreditCard } from 'lucide-react';
import type { WorkspaceSection } from './SellerWorkspace';

export type SettingsSubSection = 'all' | 'accounts' | 'courier' | 'retention';

interface WorkspaceSectionNavProps {
  currentSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  ordersCount: number;
  transactionsCount: number;
  accountsCount: number;
  activeSettingsSub?: SettingsSubSection;
  onSelectSettingsSub?: (sub: SettingsSubSection) => void;
}

export function WorkspaceSectionNav({
  currentSection,
  onSelectSection,
  ordersCount,
  transactionsCount,
  accountsCount,
  activeSettingsSub,
  onSelectSettingsSub,
}: WorkspaceSectionNavProps): React.JSX.Element {
  const text = sellerCopy[useLocale().locale];
  const isSettingsActive = currentSection === 'accounts' || currentSection === 'retention';

  return (
    <div className="workspace-nav-wrapper">
      <div className="workspace-section-tabs" role="navigation" aria-label={text.sections}>
        <button
          type="button"
          aria-current={currentSection === 'orders' ? 'page' : undefined}
          className={`workspace-section-tab ${currentSection === 'orders' ? 'active' : ''}`}
          onClick={() => onSelectSection('orders')}
        >
          <ShoppingBag size={14} aria-hidden="true" />
          <span>{text.orders}</span>
          {ordersCount > 0 && (
            <span className="section-tab-count" aria-label={`${ordersCount} ${text.newEntries}`}>
              {ordersCount}
            </span>
          )}
        </button>

        <button
          type="button"
          aria-current={currentSection === 'payments' ? 'page' : undefined}
          className={`workspace-section-tab ${currentSection === 'payments' ? 'active' : ''}`}
          onClick={() => onSelectSection('payments')}
        >
          <Smartphone size={14} aria-hidden="true" />
          <span>{text.payments}</span>
          {transactionsCount > 0 && (
            <span className="section-tab-count" aria-label={`${transactionsCount} ${text.newEntries}`}>
              {transactionsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          aria-current={isSettingsActive ? 'page' : undefined}
          className={`workspace-section-tab ${isSettingsActive ? 'active' : ''}`}
          onClick={() => onSelectSection('accounts')}
        >
          <CreditCard size={14} aria-hidden="true" />
          <span>{text.accounts}</span>
          {accountsCount > 0 && (
            <span className="section-tab-count" aria-label={`${accountsCount} ${text.newEntries}`}>
              {accountsCount}
            </span>
          )}
        </button>
      </div>

      {isSettingsActive && onSelectSettingsSub && (
        <div className="workspace-subnav-tabs" role="tablist" aria-label={text.settings}>
          <button
            type="button"
            role="tab"
            aria-selected={activeSettingsSub === 'accounts' || (!activeSettingsSub && currentSection === 'accounts')}
            className={`workspace-subnav-tab ${
              activeSettingsSub === 'accounts' || (!activeSettingsSub && currentSection === 'accounts') ? 'active' : ''
            }`}
            onClick={() => onSelectSettingsSub('accounts')}
          >
            <span>{text.accounts}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSettingsSub === 'courier'}
            className={`workspace-subnav-tab ${activeSettingsSub === 'courier' ? 'active' : ''}`}
            onClick={() => onSelectSettingsSub('courier')}
          >
            <span>{text.courier}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSettingsSub === 'retention' || (!activeSettingsSub && currentSection === 'retention')}
            className={`workspace-subnav-tab ${
              activeSettingsSub === 'retention' || (!activeSettingsSub && currentSection === 'retention') ? 'active' : ''
            }`}
            onClick={() => onSelectSettingsSub('retention')}
          >
            <span>{text.retention}</span>
          </button>
        </div>
      )}
    </div>
  );
}
