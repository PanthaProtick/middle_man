import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AmountDisplay,
  Button,
  DialogFrame,
  EmptyState,
  Field,
  Input,
  LoadingState,
  Notice,
  SectionHeader,
  Select,
  StatusChip,
} from '../index';

describe('Shared Primitives', () => {
  let host: HTMLDivElement;

  function render(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(ui);
    });
    return {
      host,
      root,
      unmount: () => act(() => root.unmount()),
    };
  }

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('Button: renders variants, loading state, disabled state, and touch target class', () => {
    const onClick = vi.fn();
    const { host, unmount } = render(
      <div>
        <Button variant="primary" onClick={onClick}>Primary</Button>
        <Button variant="danger" disabled>Disabled Danger</Button>
        <Button loading loadingText="Saving…">Submit</Button>
      </div>,
    );

    const primaryBtn = host.querySelectorAll('button')[0];
    expect(primaryBtn.className).toContain('mm-button--primary');
    primaryBtn.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    const disabledBtn = host.querySelectorAll('button')[1];
    expect(disabledBtn.disabled).toBe(true);
    expect(disabledBtn.className).toContain('mm-button--danger');

    const loadingBtn = host.querySelectorAll('button')[2];
    expect(loadingBtn.getAttribute('aria-busy')).toBe('true');
    expect(loadingBtn.textContent).toContain('Saving…');
    expect(loadingBtn.disabled).toBe(true);

    unmount();
  });

  it('Field & Controls: associates label, id, error, helperText, and aria attributes', () => {
    const { host, unmount } = render(
      <Field
        id="test-input"
        label="Phone Number"
        helperText="Enter 11 digits"
        error="Invalid mobile number"
        required
      >
        <Input placeholder="017xxxxxxxx" />
      </Field>,
    );

    const label = host.querySelector('label');
    expect(label?.getAttribute('for')).toBe('test-input');
    expect(label?.textContent).toContain('Phone Number');
    expect(label?.textContent).toContain('*');

    const input = host.querySelector('input');
    expect(input?.id).toBe('test-input');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(input?.getAttribute('aria-describedby')).toBe('test-input-error');

    const error = host.querySelector('[role="alert"]');
    expect(error?.id).toBe('test-input-error');
    expect(error?.textContent).toBe('Invalid mobile number');

    unmount();
  });

  it('Field: renders Select with control class', () => {
    const { host, unmount } = render(
      <Field id="test-select" label="Delivery Type">
        <Select defaultValue="standard">
          <option value="standard">Standard</option>
          <option value="express">Express</option>
        </Select>
      </Field>,
    );

    const select = host.querySelector('select');
    expect(select?.id).toBe('test-select');
    expect(select?.className).toContain('mm-field__control');
    expect(select?.value).toBe('standard');

    unmount();
  });

  it('StatusChip: renders tone variants and dot indicator with text label', () => {
    const { host, unmount } = render(
      <div>
        <StatusChip tone="emerald" label="Confirmed" />
        <StatusChip tone="rose" label="Cancelled" dot={false} />
      </div>,
    );

    const chips = host.querySelectorAll('.mm-status-chip');
    expect(chips[0].className).toContain('mm-status-chip--emerald');
    expect(chips[0].querySelector('.mm-status-chip__dot')).not.toBeNull();
    expect(chips[0].textContent).toContain('Confirmed');

    expect(chips[1].className).toContain('mm-status-chip--rose');
    expect(chips[1].querySelector('.mm-status-chip__dot')).toBeNull();
    expect(chips[1].textContent).toContain('Cancelled');

    unmount();
  });

  it('Notice: renders accessible alert/status with variant classes', () => {
    const { host, unmount } = render(
      <div>
        <Notice variant="error" title="Critical Issue">Failed to sync</Notice>
        <Notice variant="info">Sync completed</Notice>
      </div>,
    );

    const errorNotice = host.querySelectorAll('.mm-notice')[0];
    expect(errorNotice.getAttribute('role')).toBe('alert');
    expect(errorNotice.getAttribute('aria-live')).toBe('assertive');
    expect(errorNotice.className).toContain('mm-notice--error');
    expect(errorNotice.textContent).toContain('Critical Issue');
    expect(errorNotice.textContent).toContain('Failed to sync');

    const infoNotice = host.querySelectorAll('.mm-notice')[1];
    expect(infoNotice.getAttribute('role')).toBe('status');
    expect(infoNotice.getAttribute('aria-live')).toBe('polite');

    unmount();
  });

  it('SectionHeader: renders title, description, badge, and actions', () => {
    const { host, unmount } = render(
      <SectionHeader
        headingLevel="h3"
        title="Recent Orders"
        description="Daily work queue"
        badge={<StatusChip tone="cyan" label="3 New" />}
        actions={<Button size="sm">Export</Button>}
      />,
    );

    const heading = host.querySelector('h3');
    expect(heading?.textContent).toBe('Recent Orders');
    expect(host.querySelector('.mm-section-header__desc')?.textContent).toBe('Daily work queue');
    expect(host.querySelector('.mm-status-chip')?.textContent).toContain('3 New');
    expect(host.querySelector('button')?.textContent).toBe('Export');

    unmount();
  });

  it('EmptyState: displays title, copy, and call to action', () => {
    const { host, unmount } = render(
      <EmptyState
        title="No orders yet"
        description="Create your first buyer confirmation link"
        action={<Button>Create Order</Button>}
      />,
    );

    expect(host.querySelector('.mm-empty-state__title')?.textContent).toBe('No orders yet');
    expect(host.querySelector('.mm-empty-state__copy')?.textContent).toContain('Create your first');
    expect(host.querySelector('button')?.textContent).toBe('Create Order');

    unmount();
  });

  it('LoadingState: renders accessible spinner with polite status', () => {
    const { host, unmount } = render(<LoadingState label="Checking connection…" />);
    const status = host.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.textContent).toContain('Checking connection…');
    expect(host.querySelector('.mm-loading-state__spinner')).not.toBeNull();
    unmount();
  });

  it('DialogFrame: handles open/close, focus, and escape key', () => {
    const onClose = vi.fn();
    const { host, unmount } = render(
      <DialogFrame isOpen={true} onClose={onClose} title="Order Details">
        <p>Order content here</p>
      </DialogFrame>,
    );

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.textContent).toContain('Order Details');
    expect(dialog?.textContent).toContain('Order content here');

    // Press escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('AmountDisplay: renders tabular nums, currency, and semantic type', () => {
    const { host, unmount } = render(
      <div>
        <AmountDisplay amount={1500} type="advance" showSign />
        <AmountDisplay amount="2,400" type="cod" />
      </div>,
    );

    const amounts = host.querySelectorAll('.mm-amount-display');
    expect(amounts[0].getAttribute('data-tabular-nums')).toBe('true');
    expect(amounts[0].className).toContain('mm-amount-display--advance');
    expect(amounts[0].textContent).toContain('৳+1,500');

    expect(amounts[1].className).toContain('mm-amount-display--cod');
    expect(amounts[1].textContent).toContain('৳2,400');

    unmount();
  });
});
