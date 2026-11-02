import React, { useState } from 'react';
import { useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';
import { CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';
import './FirstRunGuide.css';

interface FirstRunGuideProps {
  hasAccounts: boolean;
  hasOrders: boolean;
  hasCourier: boolean;
  onNavigateToAccounts?: () => void;
  onNavigateToCourier?: () => void;
  onOpenCreateOrder?: () => void;
}

export function FirstRunGuide({
  hasAccounts,
  hasOrders,
  hasCourier,
  onNavigateToAccounts,
  onNavigateToCourier,
  onOpenCreateOrder,
}: FirstRunGuideProps): React.JSX.Element | null {
  const { locale } = useLocale();
  const text = sellerCopy[locale];
  const [dismissed, setDismissed] = useState(false);
  // Auto-collapse when work is already started (accounts or orders exist), expand by default for new shops
  const isWorkStarted = hasAccounts || hasOrders;
  const [expanded, setExpanded] = useState(!isWorkStarted);

  if (dismissed) return null;

  return (
    <div className="first-run-guide" role="region" aria-label={text.firstRunTitle}>
      <div className="first-run-header">
        <span className="first-run-title">{text.firstRunTitle}</span>
        <div className="first-run-actions">
          <button
            type="button"
            className="first-run-btn"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-label={expanded ? text.collapse : text.expand}
            title={expanded ? text.collapse : text.expand}
          >
            {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="first-run-btn"
            onClick={() => setDismissed(true)}
            aria-label={text.dismiss}
            title={text.dismiss}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {expanded && (
        <ol className="first-run-steps">
          <li className={`first-run-step ${hasAccounts ? 'completed' : 'pending'}`}>
            <span className="step-num">{hasAccounts ? <CheckCircle2 size={16} /> : '1'}</span>
            {onNavigateToAccounts && !hasAccounts ? (
              <button type="button" className="step-link" onClick={onNavigateToAccounts}>
                {text.firstRunStepAccount}
              </button>
            ) : (
              <span>{text.firstRunStepAccount}</span>
            )}
          </li>
          <li className={`first-run-step ${hasOrders ? 'completed' : 'pending'}`}>
            <span className="step-num">{hasOrders ? <CheckCircle2 size={16} /> : '2'}</span>
            {onOpenCreateOrder && !hasOrders ? (
              <button type="button" className="step-link" onClick={onOpenCreateOrder}>
                {text.firstRunStepOrder}
              </button>
            ) : (
              <span>{text.firstRunStepOrder}</span>
            )}
          </li>
          <li className={`first-run-step ${hasCourier ? 'completed' : 'pending'}`}>
            <span className="step-num">{hasCourier ? <CheckCircle2 size={16} /> : '3'}</span>
            {onNavigateToCourier && !hasCourier ? (
              <button type="button" className="step-link" onClick={onNavigateToCourier}>
                {text.firstRunStepCourier}
              </button>
            ) : (
              <span>{text.firstRunStepCourier}</span>
            )}
          </li>
        </ol>
      )}
    </div>
  );
}
