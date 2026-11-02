import { orders, receipt, publicOrder, timestamp } from './data';
import { revision, preview, comparison } from './extended-data';

// Renderer data only: no backend semantics, persistence or provider simulation claim.
export function extendedApi(scenario: string, fault: string) {
  let savedPublic = publicOrder;
  let current = orders.map(order => ({ ...order }));
  const writes = new Map<string, number>();
  const json = (body: unknown, status = 200) => Response.json(body, { status });
  const fail = (code: string, status: number) => json({ error: { code, message: 'Synthetic baseline condition' } }, status);
  return (url: URL, init?: RequestInit): Response | undefined => {
    const path = url.pathname;
    const method = init?.method ?? 'GET';
    if (path.startsWith('/api/seller/') && scenario.startsWith('session-')) {
      const reason = scenario === 'session-clock' ? 'not_yet_valid' : scenario === 'session-denied' ? 'origin_mismatch' : 'expired';
      return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Synthetic session rejection' } }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'X-Seller-Auth-Reason': reason },
      });
    }
    if (scenario === 'denied' && path.startsWith('/api/seller/')) return fail('FORBIDDEN', 403);
    if (path === '/api/public/orders/synthetic' && ['buyer-revoked', 'buyer-replaced'].includes(scenario)) return fail('BUYER_LINK_REVOKED', 410);
    if (path === '/api/public/orders/synthetic' && savedPublic.lifecycle !== 'awaiting_buyer') return json(savedPublic);
    if (path.endsWith('/pathao-locations') && scenario === 'buyer-locations') return json({
      condition: 'resolved', catalog_version: 'synthetic-v1', environment: 'offline', simulated: true,
      choices: [{ id: url.searchParams.has('zone_id') ? 3 : url.searchParams.has('city_id') ? 2 : 1,
        name: 'Synthetic destination / পরীক্ষামূলক গন্তব্য' }],
    });
    const id = path.split('/')[4];
    const order = current.find(item => item.id === id) ?? current[1];
    if (method === 'GET') {
      if (path.endsWith('/payment-decisions')) return json([{ transaction_id: receipt.id,
        accepted_amount_minor: 50000, actual_cod_minor: 200000, exceptions: ['AMOUNT_MISMATCH'],
        reason: 'Synthetic deliberate acceptance', actor: 'synthetic-seller', created_at: timestamp }]);
      if (path === '/api/seller/payment-summary') return json({ confirmed_count: 1, manual_count: 1, exception_count: 1 });
      if (path.endsWith('/history')) return json({ items: [revision], next_cursor: null });
      if (path.endsWith('/payment-preview')) return json({ ...preview,
        blockers: fault === 'blocked' ? ['PAYMENT_ALREADY_USED'] : [] });
      if (path === `/api/seller/transactions/${receipt.id}`) return json(comparison);
      if (path.endsWith('/sms-imports')) return json({ items: [], next_cursor: null });
      if (/\/(order|transaction)-submissions$/.test(path)) return json({ storage_epoch: 'baseline-epoch' });
      if (/\/(order|transaction)-submissions\//.test(path)) return json({ state: 'not_found', order: null, result: null });
      if (path === '/api/seller/orders' && ['paging', 'long'].includes(scenario)) {
        const query = url.searchParams.get('q') ?? url.searchParams.get('search');
        const rows = scenario === 'long' ? current.map(item => ({ ...item,
          product_name: Array.from('দীর্ঘপরীক্ষামূলকপণ্যেরনাম'.repeat(5) + 'UNBROKEN'.repeat(15)).slice(0, 200).join('') })) : current;
        return json({ items: query ? [] : url.searchParams.has('cursor') ? [rows[2]] : rows.slice(0, 2),
          next_cursor: query || url.searchParams.has('cursor') ? null : 'synthetic-page-2' });
      }
      if (path === '/api/seller/orders') return undefined;
      if (path === `/api/seller/orders/${id}`) return json(order);
      return undefined;
    }
    // Allow only these local, known routes; the caller rejects all other writes.
    if (path.endsWith('/review-assistance')) {
      const input = JSON.parse(String(init?.body)) as { receipt_id?: string; language?: string; generate?: boolean };
      if (fault === 'advice-error') return fail('PROVIDER_UNAVAILABLE', 503);
      return json({ order_id: order.id, order_version: order.version, buyer_revision: order.buyer_revision,
        lifecycle: 'pending', source: 'local', condition: 'AMOUNT_MISMATCH', context_token: 'baseline-context',
        selected_receipt_id: input.receipt_id ?? null, selected_receipt_version: input.receipt_id ? 1 : null,
        preview_conditions: ['AMOUNT_MISMATCH'], preview_blockers: [], reason_codes: ['AMOUNT_MISMATCH'],
        explanation: input.language === 'bn' ? 'পরীক্ষামূলক পরামর্শ: অর্থের পার্থক্য যাচাই করুন।' : 'Synthetic advice: review the amount difference.',
        unknown_reason_present: false, fallback_status: input.generate ? 'unconfigured' : null,
        context: { condition: 'AMOUNT_MISMATCH', reason_codes: ['AMOUNT_MISMATCH'], unknown_reason_present: false,
          locale: input.language ?? 'en', facts: { has_matching_receipt: true }, permitted_actions: [] },
        facts: { has_matching_receipt: true, total_minor: 250000 }, suggested_actions: [], locale: input.language ?? 'en',
      });
    }
    const known = path === '/api/seller/orders' || path === '/api/seller/transactions' ||
      /\/(buyer-details|decisions|replacement|revoke-link|reissue-link|submission|resolve)$/.test(path) ||
      /\/(order|transaction)-submissions\//.test(path) || path === `/api/seller/transactions/${receipt.id}`;
    if (!known) return undefined;
    const key = new Headers(init?.headers).get('Idempotency-Key') ?? path;
    writes.set(key, (writes.get(key) ?? 0) + 1);
    if (fault === 'stale') return fail('STALE_VERSION', 409);
    if (fault === 'unknown' && writes.get(key) === 1) return fail('HTTP_503', 503);
    if (fault === 'reset') return fail('SUBMISSION_STORAGE_RESET', 409);
    const input = JSON.parse(String(init?.body ?? '{}')) as { action?: string; product_name?: string };
    if (path.endsWith('/submission')) {
      savedPublic = { ...publicOrder, lifecycle: 'pending', status_message: 'Synthetic claim received; awaiting review.' };
      return json(savedPublic);
    }
    if (path.endsWith('/resolve') || path === `/api/seller/transactions/${receipt.id}`) return json(comparison);
    if (path === '/api/seller/transactions') return json(receipt);
    if (path.includes('/transaction-submissions/')) return json({ receipt, allocated_order_ids: [] });
    if (path === '/api/seller/orders' || path.includes('/order-submissions/')) return json({ ...orders[0],
      id: 'baseline-created', product_name: input.product_name ?? 'Synthetic new order' });
    const updated = { ...order, version: order.version + 1,
      lifecycle: input.action === 'confirm' ? 'confirmed' as const : input.action === 'cancel' ? 'cancelled' as const : input.action === 'reject' ? 'rejected' as const : order.lifecycle,
      allocation_basis: input.action === 'confirm' ? 'manual' as const : order.allocation_basis,
      actual_cod_minor: input.action === 'confirm' ? 200000 : order.actual_cod_minor,
      buyer_link_revoked_at: path.endsWith('/revoke-link') ? timestamp : null,
      portal_url: path.endsWith('/reissue-link') ? '/orders/synthetic-reissued' : order.portal_url,
    };
    current = current.map(item => item.id === order.id ? updated : item);
    return json(updated);
  };
}
