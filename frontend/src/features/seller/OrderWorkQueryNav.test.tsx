import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { OrderWorkQueryNav } from './OrderWorkQueryNav';
import { orderCopy } from '../locale/orderCopy';

afterEach(() => {
  document.body.innerHTML = '';
});

async function mount(element: React.JSX.Element) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, root };
}

it('renders work query tabs and highlights selected query', async () => {
  const onSelect = vi.fn();
  const { host, root } = await mount(
    <OrderWorkQueryNav workQuery="" onSelectWorkQuery={onSelect} text={orderCopy.en} />,
  );

  const tabs = host.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  expect(tabs).toHaveLength(3);
  expect(tabs[0].textContent).toBe('Needs Attention');
  expect(tabs[1].textContent).toBe('Ready for Delivery');
  expect(tabs[2].textContent).toBe('All Orders');

  expect(tabs[0].getAttribute('aria-selected')).toBe('false');
  expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  expect(tabs[2].getAttribute('aria-selected')).toBe('true');

  await act(async () => tabs[0].click());
  expect(onSelect).toHaveBeenCalledWith('attention');

  await act(async () => tabs[1].click());
  expect(onSelect).toHaveBeenCalledWith('preparation');

  await act(async () => {
    root.render(
      <OrderWorkQueryNav workQuery="attention" onSelectWorkQuery={onSelect} text={orderCopy.en} />,
    );
  });
  expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  expect(tabs[0].classList.contains('active')).toBe(true);
  expect(tabs[2].getAttribute('aria-selected')).toBe('false');

  await act(async () => {
    root.render(
      <OrderWorkQueryNav workQuery="preparation" onSelectWorkQuery={onSelect} text={orderCopy.bn} />,
    );
  });
  expect(tabs[1].textContent).toBe('ডেলিভারির জন্য প্রস্তুত');
  expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  expect(tabs[1].classList.contains('active')).toBe(true);

  await act(async () => tabs[2].click());
  expect(onSelect).toHaveBeenCalledWith('');
});
