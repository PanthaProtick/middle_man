import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('buyer deep links use SPA fallback while builds use the frontend lockfile', () => {
  const config = JSON.parse(read('frontend/vercel.json'));
  assert.equal(config.framework, 'vite');
  assert.equal(config.installCommand, 'npm ci');
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.outputDirectory, 'dist');
  const fallback = config.rewrites.find(rule => new RegExp(`^${rule.source}$`).test('/orders/synthetic-token'));
  assert.equal(fallback?.destination, '/index.html');
  assert.equal(JSON.parse(read('frontend/package.json')).engines.node, '22.x');
});

test('environment templates expose only public frontend values and previews start offline', () => {
  for (const environment of ['production', 'preview']) {
    const frontend = read(`frontend/.env.${environment}.example`);
    const keys = frontend.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => line.split('=')[0]);
    assert.deepEqual(keys.sort(), ['VITE_API_BASE_URL', 'VITE_CLERK_PUBLISHABLE_KEY']);
    assert.match(frontend, /VITE_API_BASE_URL=https:\/\/[^\s]+\/api/);
  }
  const preview = read('backend/.env.preview.example');
  for (const setting of ['DATABASE_URL=', 'DIRECT_URL=', 'CLERK_SECRET_KEY=', 'GEMINI_API_KEY=',
    'SELF_TEST_MODE=false', 'PATHAO_PRODUCTION_BOOKING_ENABLED=false', 'ENV=development']) {
    assert.ok(preview.split(/\r?\n/).includes(setting), `Missing safe default: ${setting}`);
  }
  const backend = JSON.parse(read('backend/vercel.json'));
  assert.equal(backend.installCommand, 'uv sync --locked --no-dev');
  assert.equal(backend.framework, 'fastapi');
});

test('retention cron targets only the backend maintenance endpoint daily', () => {
  assert.deepEqual(JSON.parse(read('backend/vercel.json')).crons, [
    { path: '/api/maintenance/retention', schedule: '0 0 * * *' },
  ]);
  for (const environment of ['production', 'preview']) {
    assert.ok(read(`backend/.env.${environment}.example`).split(/\r?\n/).includes('CRON_SECRET='));
  }
  assert.equal(JSON.parse(read('frontend/vercel.json')).crons, undefined);
});
