const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const checks = [];
  try {
    for (const width of [375, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let mode = 'loading';
      let release;
      let submitted;
      let lifecycle = 'awaiting_buyer';
      const calls = [];
      const order = () => ({
        id: 'synthetic', shop_display_name: 'Synthetic Shop', product_name: 'Synthetic Item',
        total_minor: 200000, required_advance_minor: 50000, expected_cod_minor: 150000,
        actual_cod_minor: null, account_provider: 'bkash', account_receiving_number: '01712345678',
        account_label: 'Shop', lifecycle, status_message: lifecycle === 'pending' ? 'Payment pending seller review' : 'Enter details',
        submission_acknowledgement: null, created_at: '2026-10-27T00:00:00Z',
        expires_at: '2026-10-28T00:00:00Z', completed_at: null, ai_assistance_available: false,
      });
      await page.route('**/api/**', async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        calls.push(path);
        if (path.endsWith('/pathao-locations')) return route.fulfill({ json: { condition: 'disconnected', choices: [] } });
        if (path.endsWith('/submission')) {
          submitted = request.postDataJSON();
          lifecycle = 'pending';
          return route.fulfill({ json: order() });
        }
        if (mode === 'loading') await new Promise(resolve => { release = resolve; });
        if (mode === 'error') return route.fulfill({ status: 503, json: { error: { code: 'DATABASE_UNAVAILABLE', message: 'Please retry' } } });
        return route.fulfill({ json: order() });
      });
      await page.goto('http://127.0.0.1:5187/orders/synthetic');
      await page.getByText(/Loading order details/).waitFor();
      await page.waitForFunction(() => document.querySelector('[role="status"]') !== null);
      // The request is held at the mocked boundary until the loading UI is inspected.
      while (!release) await new Promise(resolve => setTimeout(resolve, 10));
      mode = 'ready'; release();
      await page.locator('#buyer_name').waitFor();
      assert.equal(await page.locator('input[type="file"]').count(), 0);
      assert.doesNotMatch(await page.locator('body').innerText(), /screenshot|send.*gemini/i);
      await page.getByRole('button', { name: /Submit Order Details/ }).click();
      await page.locator('#buyer_name-error').waitFor();
      assert.equal(submitted, undefined);
      for (const [id, value] of Object.entries({ buyer_name: 'Synthetic Buyer', contact_number: '01711111111',
        address_raw: 'Synthetic Dhaka address', payment_sender: '01822222222', payment_trx_id: 'MANUAL001', claimed_advance_bdt: '500' })) {
        await page.locator('#' + id).fill(value);
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole('button', { name: /Submit Order Details/ }).click();
      await page.getByRole('heading', { name: /Pending Seller Review/ }).waitFor();
      assert.deepEqual(submitted.payment_claim, { provider: 'bkash', trx_id: 'MANUAL001', sender_number: '01822222222', amount_minor: 50000 });
      assert(!calls.some(path => /evidence|payment-extraction/.test(path)));
      mode = 'error';
      await page.reload();
      await page.getByRole('heading', { name: /Unable to Load Order/ }).waitFor();
      mode = 'ready';
      await page.getByRole('button', { name: /Retry/ }).click();
      await page.getByRole('heading', { name: /Pending Seller Review/ }).waitFor();
      assert.deepEqual(errors, []);
      checks.push({ width, loading: 'PASS', validation: 'PASS', manual_submission: 'PASS',
        no_screenshot_controls_or_requests: 'PASS', error_recovery: 'PASS', overflow: 'PASS' });
      await page.close();
    }
    fs.writeFileSync('.scratch/screenshot-removal-browser-result.json', JSON.stringify({ status: 'PASS', boundary: 'Real browser; mocked API; synthetic records', checks }, null, 2));
    console.log(JSON.stringify({ status: 'PASS', checks }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
