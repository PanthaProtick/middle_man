import React, { useState } from 'react';
import {
  Smartphone,
  CheckCircle2,
  Truck,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import type { WalkthroughStepId } from './types';
import { landingCopy } from './landingCopy';
import type { Locale } from '../locale';

interface InteractiveProductTourProps {
  locale: Locale;
}

export function InteractiveProductTour({ locale }: InteractiveProductTourProps): React.JSX.Element {
  const [activeStep, setActiveStep] = useState<WalkthroughStepId>('chat');
  const [copiedLink, setCopiedLink] = useState(false);
  const copy = landingCopy[locale].tour;
  const steps = copy.steps;
  const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
  const currentStep = steps[currentStepIndex] ?? steps[0];

  const handleNext = () => {
    const nextIdx = (currentStepIndex + 1) % steps.length;
    setActiveStep(steps[nextIdx].id);
  };

  const handlePrev = () => {
    const prevIdx = (currentStepIndex - 1 + steps.length) % steps.length;
    setActiveStep(steps[prevIdx].id);
  };

  const handleCopyLink = () => {
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <section className="tour-section" aria-labelledby="tour-heading">
      <div className="tour-header">
        <h2 id="tour-heading">{copy.sectionHeading}</h2>
        <p className="tour-description">{copy.sectionDescription}</p>
      </div>

      <div className="tour-stepper" role="group" aria-label={copy.sectionHeading}>
        {steps.map((step, idx) => {
          const isSelected = step.id === activeStep;
          return (
            <button
              key={step.id}
              type="button"
              aria-pressed={isSelected}
              id={`step-tab-${step.id}`}
              className={`step-tab ${isSelected ? 'active' : ''}`}
              onClick={() => setActiveStep(step.id)}
            >
              <span className="step-number" aria-hidden="true">{idx + 1}</span>
              <span className="step-title">{step.title}</span>
            </button>
          );
        })}
      </div>

      <div className="tour-stage">
        <div
          key={currentStep.id}
          id={`step-panel-${currentStep.id}`}
          className="tour-narrative"
        >
          <span className="tour-step-tag">{currentStep.tag}</span>
          <h3>{currentStep.title}</h3>
          <h4>{currentStep.subtitle}</h4>
          <p>{currentStep.caption}</p>

          <div className="tour-navigation">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              aria-label={copy.prevStep}
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>{copy.prevStep}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleNext}
              aria-label={copy.nextStep}
            >
              <span>{copy.nextStep}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="tour-screen-canvas" aria-live="polite">
          {activeStep === 'chat' && (
            <div className="mock-phone-shell">
              <div className="mock-phone-notch" />
              <div className="mock-chat-header">
                <div className="chat-avatar">TA</div>
                <div className="chat-meta">
                  <strong>{copy.simulation.customerName}</strong>
                  <span>Active in Messenger</span>
                </div>
              </div>
              <div className="mock-chat-body">
                <div className="chat-bubble incoming">
                  <p>ভাইয়া, {copy.simulation.productName} নিতে চাই। মিরপুর-২ এ পৌঁছে দিবেন?</p>
                  <span className="bubble-time">10:42 AM</span>
                </div>
                <div className="chat-bubble outgoing">
                  <p>ধন্যবাদ ভাইয়া! আপনার মোট বিল <strong>{copy.simulation.totalAmount}</strong>। ডেলিভারি নিশ্চিত করতে <strong>{copy.simulation.advanceAmount}</strong> টাকা অগ্রিম দিতে এই লিংকে তথ্য দিন:</p>
                  <span className="bubble-time">10:43 AM</span>
                </div>
                <div className="chat-order-card">
                  <div className="chat-card-top">
                    <Smartphone size={16} aria-hidden="true" />
                    <span>middleman.app/orders/dh-8492</span>
                  </div>
                  <p className="chat-card-title">{copy.simulation.productName}</p>
                  <p className="chat-card-amt">ডেলিভারি অগ্রিম: {copy.simulation.advanceAmount}</p>
                  <button type="button" className="chat-copy-btn" onClick={handleCopyLink}>
                    {copiedLink ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                    <span>{copiedLink ? 'Copied' : 'Copy Buyer Link'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeStep === 'portal' && (
            <div className="mock-phone-shell">
              <div className="mock-phone-notch" />
              <div className="mock-portal-header">
                <span className="portal-badge">Buyer Portal</span>
                <span className="portal-order-id">#DH-8492</span>
              </div>
              <div className="mock-portal-body">
                <div className="portal-tally-box">
                  <div className="tally-row">
                    <span>Total Bill:</span>
                    <strong className="num">{copy.simulation.totalAmount}</strong>
                  </div>
                  <div className="tally-row highlight">
                    <span>Required Advance:</span>
                    <strong className="num">{copy.simulation.advanceAmount}</strong>
                  </div>
                  <div className="tally-row cod">
                    <span>Remaining COD:</span>
                    <strong className="num">{copy.simulation.codAmount}</strong>
                  </div>
                </div>
                <div className="mock-portal-field">
                  <label>Delivery Address:</label>
                  <div className="mock-input">{copy.simulation.customerAddress}</div>
                </div>
                <div className="mock-portal-field">
                  <label>bKash TrxID:</label>
                  <div className="mock-input font-tabular">{copy.simulation.trxId}</div>
                </div>
                <div className="mock-portal-action">
                  <button type="button" className="btn btn-primary btn-block" disabled>
                    <CheckCircle2 size={14} aria-hidden="true" /> Confirm Order & Advance
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeStep === 'reconciliation' && (
            <div className="mock-desk-shell">
              <div className="mock-desk-header">
                <span className="desk-title">Shop Desk Inbox</span>
                <span className="status-chip success">{copy.simulation.verifiedChip}</span>
              </div>
              <div className="mock-recon-grid">
                <div className="recon-card buyer-side">
                  <span className="recon-label">Buyer Claim</span>
                  <p className="recon-party">{copy.simulation.customerName} ({copy.simulation.customerPhone})</p>
                  <p className="recon-amount num">{copy.simulation.advanceAmount}</p>
                  <span className="recon-tag">TrxID: {copy.simulation.trxId}</span>
                </div>
                <div className="recon-divider">
                  <ShieldCheck size={20} color="var(--primary-accent)" aria-hidden="true" />
                  <span>Exact Match</span>
                </div>
                <div className="recon-card seller-side">
                  <span className="recon-label">Seller payment record</span>
                  <p className="recon-party">Received from {copy.simulation.customerPhone}</p>
                  <p className="recon-amount num">{copy.simulation.advanceAmount}</p>
                  <span className="recon-tag">TrxID: {copy.simulation.trxId}</span>
                </div>
              </div>
              <div className="mock-recon-footer">
                <p>Seller payment record matched with the buyer claim. Ready for courier preparation.</p>
              </div>
            </div>
          )}

          {activeStep === 'courier' && (
            <div className="mock-desk-shell">
              <div className="mock-desk-header">
                <span className="desk-title">Pathao Courier Preparation</span>
                <span className="status-chip ready">{copy.simulation.dispatchedChip}</span>
              </div>
              <div className="courier-slip">
                <div className="courier-badge-row">
                  <Truck size={18} color="var(--primary-accent)" aria-hidden="true" />
                  <span className="courier-tag font-tabular">{copy.simulation.courierTag}</span>
                </div>
                <div className="courier-details">
                  <p><strong>Recipient:</strong> {copy.simulation.customerName}</p>
                  <p><strong>Phone:</strong> {copy.simulation.customerPhone}</p>
                  <p><strong>Zone:</strong> Mirpur-2, Dhaka (City Express)</p>
                  <div className="courier-cod-box">
                    <span>Cash on Delivery (COD) to collect:</span>
                    <strong className="num cod-amount">{copy.simulation.codAmount}</strong>
                  </div>
                </div>
                <button type="button" className="btn btn-primary btn-block" disabled>
                  Stage Parcel in Pathao
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
