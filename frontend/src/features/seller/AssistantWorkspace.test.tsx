import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { SellerWorkspace } from './SellerWorkspace';
import { AssistantWorkspace } from './AssistantWorkspace';
import { OrderList } from './OrderList';
import { baseOrder } from './reviewAssistanceTestSupport';
import App from '../../App';

let root: Root;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

it('clarifies locally and recognizes multilingual workflows independently of app language', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<AssistantWorkspace floating><p>Orders</p></AssistantWorkspace>));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
  const send = async (value: string) => {
    const input = host.querySelector<HTMLTextAreaElement>('[name="assistant-message"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  };
  await send('Cancel every order');
  expect(host.querySelector('[role="log"]')?.textContent).toContain('Choose one of the four workflows');
  for (const message of ['Show orders needing attention', 'যে অর্ডারে নজর দিতে হবে', 'attention dorkar emon order', 'পুরোনো orders needing attention']) {
    await send(message);
    expect(host.querySelector('[data-testid="assistant-workflow"]')?.textContent).toMatch(/attention|নজর/);
  }
  for (const message of ['Create an order', 'নতুন অর্ডার তৈরি', 'ekta notun order chai', 'order toiri korte chai']) {
    await act(async () => host.querySelectorAll<HTMLButtonElement>('.assistant-workflow-choices button')[2].click());
    await send(message);
    expect(host.querySelector('[name="assistant-draft"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="assistant-workflow"]')?.textContent).toMatch(/Create an order|অর্ডার তৈরি/);
  }
  const language = host.querySelector<HTMLSelectElement>('[name="assistant-language"]')!;
  await act(async () => { language.value = 'en'; language.dispatchEvent(new Event('change', { bubbles: true })); });
  await send('ডেলিভারির প্রস্তুতি বাকি অর্ডার');
  expect(host.querySelector('[data-testid="assistant-workflow"]')?.textContent).toContain('Awaiting delivery preparation');
  expect(localStorage.getItem('middleman.locale')).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

it('offers one assistant across seller sections and removes it on sign-out', async () => {
  let holdShop = false;
  let finishShop: (response: Response) => void = () => undefined;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    if (holdShop && String(url).endsWith('/seller/shop')) return new Promise<Response>(resolve => { finishShop = resolve; });
    return new Response(JSON.stringify(
    String(url).endsWith('/seller/shop')
      ? { shop: { id: 'shop-1', display_name: 'Test shop' }, setup_needed: false }
      : String(url).includes('payment-accounts') ? [] : { items: [], next_cursor: null },
    ), { status: String(url).includes('retention') ? 503 : 200 });
  });
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  for (const activeSection of ['orders', 'payments', 'accounts', 'retention'] as const) {
    await act(async () => root.render(<SellerWorkspace token="seller" activeSection={activeSection} />));
    expect(host.querySelectorAll('[data-testid="seller-assistant-launcher"]')).toHaveLength(1);
    if (activeSection === 'orders') {
      await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
      await act(async () => host.querySelector<HTMLButtonElement>('.assistant-workflow-choices button')!.click());
    }
    expect(host.querySelector('[name="assistant-draft"]')).not.toBeNull();
  }
  holdShop = true;
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Refresh')!.click());
  expect(host.querySelector('[name="assistant-draft"]')).not.toBeNull();
  await act(async () => finishShop(new Response(JSON.stringify({ shop: { id: 'shop-1', display_name: 'Test shop' }, setup_needed: false }))));
  expect(host.querySelector('[name="assistant-draft"]')).not.toBeNull();
  holdShop = true;
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Refresh')!.click());
  await act(async () => finishShop(new Response(JSON.stringify({ shop: { id: 'shop-2', display_name: 'Other shop' }, setup_needed: false }))));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
  expect(host.querySelector('[name="assistant-draft"]')).toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('.assistant-workflow-choices button')!.click());
  holdShop = false;
  await act(async () => root.render(<SellerWorkspace />));
  expect(host.querySelector('[data-testid="seller-assistant-launcher"]')).toBeNull();
  await act(async () => root.render(<SellerWorkspace token="seller" />));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
  expect(host.querySelector('[name="assistant-draft"]')).toBeNull();
});

it('never mounts the seller assistant on a public buyer page, even with a seller token', async () => {
  window.history.replaceState({}, '', '/orders/synthetic');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<App token="seller" />));
  expect(host.querySelector('.portal-shell')).not.toBeNull();
  expect(host.querySelector('[data-testid="seller-assistant-launcher"]')).toBeNull();
});

it('offers general workflows inside order details even without an eligible review', async () => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<AssistantWorkspace floating>
    <OrderList orders={[{ ...baseOrder, lifecycle: 'confirmed' }]} token="seller" statusFilter=""
      onFilterChange={() => undefined} nextCursor={null} onLoadMore={() => undefined} />
  </AssistantWorkspace>));
  await act(async () => host.querySelector<HTMLButtonElement>('.order-card-actions button')!.click());
  const dialog = host.querySelector('dialog')!;
  expect(dialog.querySelector('[data-testid="seller-assistant-launcher"]')).not.toBeNull();
  await act(async () => dialog.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
  expect(dialog.querySelector('[name="assistant-message"]')).not.toBeNull();
  await act(async () => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
  expect(dialog.open).toBe(true);
  expect(dialog.querySelector('[name="assistant-message"]')).toBeNull();
});
