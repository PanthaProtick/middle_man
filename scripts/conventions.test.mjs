import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  brokenLinks, checkConventions, commandFindings, conventions, lineCount, scratchFindings, sizeFindings,
} from './conventions.mjs';

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'repository-conventions-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const write = (name, value) => {
    mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    writeFileSync(path.join(directory, name), value);
  };
  write('package.json', JSON.stringify({ scripts: { check: 'node check.mjs', test: 'node test.mjs' } }));
  return { directory, write };
}

test('tracked scratch accepts Markdown work records and rejects execution artifacts', () => {
  const findings = scratchFindings([
    '.scratch/feature/spec.md',
    '.scratch/feature/issues/01-ticket.md',
    '.scratch/feature/result.json',
    '.scratch/feature/browser.cjs',
    'docs/verification/result.json',
  ]);
  assert.equal(findings.length, 2);
  assert.match(findings[0], /^\.scratch\/feature\/result\.json: /);
  assert.match(findings[1], /^\.scratch\/feature\/browser\.cjs: /);
});

test('size review reports the trigger, fails above the maximum, and permits only explained test exceptions', () => {
  const files = [
    { path: 'backend/app/large.py', lines: 301 },
    { path: 'backend/app/review.py', lines: 250 },
    { path: 'backend/app/small.py', lines: 249 },
    { path: 'backend/tests/test_journey.py', lines: 340 },
    { path: 'frontend/src/feature/Journey.test.tsx', lines: 320 },
    { path: 'scripts/tooling.test.mjs', lines: 305 },
    { path: 'backend/migrations/0001.sql', lines: 900 },
  ];
  const exceptions = new Map([
    ['backend/tests/test_journey.py', 'one durable recovery story'],
    ['frontend/src/feature/Journey.test.tsx', '  '],
    ['scripts/tooling.test.mjs', 'check runner failure and replay cases'],
  ]);
  const result = sizeFindings(files, exceptions);
  assert.deepEqual(result.reviews, ['backend/app/review.py (250)']);
  assert.equal(result.failures.length, 2);
  assert.match(result.failures[0], /^backend\/app\/large\.py is 301 physical lines/);
  assert.match(result.failures[1], /^frontend\/src\/feature\/Journey\.test\.tsx is 320 physical lines/);
  assert.equal(result.allowed.length, 2);
  assert.match(result.allowed[0], /^backend\/tests\/test_journey\.py \(340\): one durable recovery story$/);
  assert.match(result.allowed[1], /^scripts\/tooling\.test\.mjs \(305\): check runner failure and replay cases$/);
});

test('line counts ignore a trailing newline but retain blank physical lines', () => {
  assert.equal(lineCount('first\n\nthird\n'), 3);
  assert.equal(lineCount(''), 0);
});

test('maintained links resolve relative to their document and ignore external or anchor targets', t => {
  const { directory, write } = fixture(t);
  write('docs/README.md', [
    '[guide](guide.md#usage)',
    '[image](assets/shot.png)',
    '[external](https://example.com/missing.md)',
    '[anchor](#local)',
  ].join('\n'));
  write('docs/guide.md', '# Guide\n');
  write('docs/assets/shot.png', 'png');
  assert.deepEqual(brokenLinks(directory, ['docs/README.md']), []);

  write('docs/README.md', '[missing](missing.md)\n');
  assert.match(brokenLinks(directory, ['docs/README.md'])[0], /link target does not exist: missing\.md/);
});

test('documented commands must exist in package.json without rejecting focused arguments', t => {
  const { directory, write } = fixture(t);
  write('AGENTS.md', 'Run `npm run check`. Focus with `npm run test -- tests/demo.py`.\n');
  assert.deepEqual(commandFindings(directory, ['AGENTS.md']), []);
  write('AGENTS.md', 'Run `npm run removed-command`.\n');
  assert.deepEqual(commandFindings(directory, ['AGENTS.md']), [
    'AGENTS.md: npm run removed-command is not a package.json script',
  ]);
});

test('the full check reports scratch, size, link, and command regressions together', t => {
  const { directory, write } = fixture(t);
  write('.scratch/demo/result.json', '{}');
  write('backend/app/large.py', `${'x\n'.repeat(301)}`);
  write('README.md', '[missing](docs/missing.md); run `npm run unavailable`.\n');
  const files = ['.scratch/demo/result.json', 'backend/app/large.py', 'README.md'];
  const report = checkConventions({ workspace: directory, files });
  assert.match(report.findings.join('\n'), /tracked scratch files must be Markdown/);
  assert.match(report.findings.join('\n'), /backend\/app\/large\.py is 301 physical lines/);
  assert.match(report.findings.join('\n'), /link target does not exist/);
  assert.match(report.findings.join('\n'), /npm run unavailable/);
});

test('the conventions command succeeds on a clean workspace and fails with findings', t => {
  const { directory, write } = fixture(t);
  write('README.md', '[guide](guide.md)\n');
  write('guide.md', '# Guide\n');
  assert.doesNotThrow(() => conventions({ workspace: directory, files: ['README.md', 'guide.md'] }));
  write('.scratch/demo/result.json', '{}');
  assert.throws(
    () => conventions({ workspace: directory, files: ['.scratch/demo/result.json', 'README.md', 'guide.md'] }),
    /Repository conventions failed[\s\S]*tracked scratch files must be Markdown/,
  );
});
