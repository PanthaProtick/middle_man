import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { EvidenceRetentionPanel } from './EvidenceRetentionPanel';
import { StructuredRetentionPanel } from './StructuredRetentionPanel';
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
it('translates partial purge counts and deadlines without repeating deletion', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const status = {counts:{sms_active:2,sms_purged:3,ai_extractions_active:0,ai_extractions_purged:1},overdue_count:1,failed_count:1,last_cleanup_at:'2026-10-24T00:00:00Z',overdue_items:[{evidence_type:'sms',evidence_id:'sms-১২',delete_after:'2026-10-23T00:00:00Z',error:'private driver text'}]};
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(status)))
    .mockResolvedValueOnce(new Response(JSON.stringify({items_purged:2,items_failed:1,overdue_remaining:1})))
    .mockResolvedValueOnce(new Response(JSON.stringify(status)));
  const host=document.createElement('div'); document.body.append(host); const root=createRoot(host);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><EvidenceRetentionPanel token="seller" /></LocaleProvider>));
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Run Evidence Cleanup"]')!.click());
  expect(host.textContent).toContain('Purged 2 raw items (1 failed, 1 overdue remaining).');
  await act(async () => Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='বাংলা')!.click());
  expect(host.textContent).toContain('2টি মূল তথ্য মুছে ফেলা হয়েছে (1টি ব্যর্থ, 1টির সময় পেরিয়েছে)।');
  expect(host.textContent).toContain('অক্টোবর'); expect(host.textContent).toContain('sms-১২');
  expect(host.textContent).not.toContain('private driver text'); expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls[1]?.[1]).toMatchObject({method:'POST',headers:{Authorization:'Bearer seller'}});
  await act(async()=>root.unmount()); host.remove();
});
it('translates a saved permission failure without retrying cleanup', async () => {
  localStorage.setItem('middleman.locale','bn');
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({error:{code:'FORBIDDEN',message:'private diagnostic'}}),{status:403}));
  const host=document.createElement('div'); document.body.append(host); const root=createRoot(host);
  await act(async()=>root.render(<LocaleProvider><LocaleSwitch /><StructuredRetentionPanel token="seller" /></LocaleProvider>));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('প্রবেশের অনুমতি নেই');
  await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='English')!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Access denied');
  expect(host.textContent).not.toContain('private diagnostic'); expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async()=>root.unmount()); host.remove();
});
