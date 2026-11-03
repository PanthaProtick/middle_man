import React, { useEffect, useRef } from 'react';
import { Button } from './Button';

export interface DialogFrameProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  sheetOnMobile?: boolean;
  className?: string;
  closeAriaLabel?: string;
}

export function DialogFrame({
  isOpen,
  onClose,
  title,
  children,
  footer,
  sheetOnMobile = true,
  className = '',
  closeAriaLabel = 'Close dialog',
}: DialogFrameProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first focusable element or panel
    const focusTimer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      } else {
        panelRef.current?.focus();
      }
    }, 10);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(el => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedElement.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const backdropClass = [
    'mm-dialog-backdrop',
    sheetOnMobile ? 'mm-dialog-backdrop--sheet' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={backdropClass}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mm-dialog-title"
        tabIndex={-1}
        className={`mm-dialog-panel ${className}`.trim()}
      >
        <div className="mm-dialog-header">
          <h2 id="mm-dialog-title" className="mm-dialog-title">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            aria-label={closeAriaLabel}
            onClick={onClose}
          >
            ✕
          </Button>
        </div>
        <div className="mm-dialog-body">{children}</div>
        {footer && <div className="mm-dialog-footer">{footer}</div>}
      </div>
    </div>
  );
}
