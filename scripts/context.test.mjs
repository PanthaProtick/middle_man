import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { context } from './context.mjs';

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'bounded-context-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const write = (name, value) => {
    mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    writeFileSync(path.join(directory, name), value);
  };
  write('AGENTS.md', '# Shared rules\n');
  write('backend/app/demo.py', 'first\r\nsecond\r\nthird\r\n');
  return { directory, write };
}

test('context map emits source paths, without loading bodies, dependencies, secrets, or skills', t => {
  const { directory, write } = fixture(t);
  write('backend/app/.env', 'PRIVATE');
  write('backend/app/node_modules/demo.ts', 'GENERATED');
  write('backend/app/secrets.json', 'PRIVATE');
  write('backend/.env.example', 'SAMPLE=true');
  write('.agents/skills/demo/SKILL.md', 'HUGE SKILL BODY');
  const output = context([], directory);
  assert.match(output, /backend\/app\/demo.py/);
  assert.match(output, /backend\/\.env.example/);
  assert.doesNotMatch(output, /\nfirst\r?\n|PRIVATE|secrets\.json|node_modules|HUGE SKILL BODY/);
});

test('explicit files retain exact lines, ranges and provenance without duplicate selections', t => {
  const { directory, write } = fixture(t);
  const output = context(['backend/app/demo.py#L2-L3', 'backend/app/demo.py#L2-L3'], directory);
  assert.match(output, /\(2-3 of 3 lines\)/);
  assert.match(output, /2: second\n3: third/);
  assert.doesNotMatch(output, /first/);
  assert.equal(output.match(/--- backend/g).length, 1);
  write('backend/app/empty.py', '');
  assert.match(context(['backend/app/empty.py'], directory), /empty file/);
});

test('context rejects escape paths, private files and generated files even when explicitly requested', t => {
  const { directory, write } = fixture(t);
  for (const name of ['.env', 'backend/.env.production', 'backend/private.key', 'backend/credentials.json',
    'backend/.venv/demo.py', 'frontend/node_modules/a.ts', 'tasks/local/task.md', 'frontend/dist/a.ts',
    'TASKS/LOCAL/task.md', 'backend/app/demo.py:private.py']) {
    write(name, 'PRIVATE');
    assert.throws(() => context([name], directory), /refuses/);
  }
  assert.throws(() => context(['../escape.py'], directory), /refuses/);
  write('backend/.env.example', 'SAMPLE=true');
  assert.match(context(['backend/.env.example'], directory), /SAMPLE=true/);
});

test('context refuses binary, oversized output and invalid ranges with no partial result', t => {
  const { directory, write } = fixture(t);
  write('backend/app/binary.py', Buffer.from([0, 1, 2]));
  write('backend/app/big.py', 'x'.repeat(24000));
  write('backend/app/huge.py', 'x'.repeat(1000001));
  assert.throws(() => context(['AGENTS.md', 'backend/app/binary.py'], directory), /binary/);
  assert.throws(() => context(['backend/app/big.py'], directory), /exceeds 24 KB/);
  assert.throws(() => context(['backend/app/huge.py'], directory), /below 1 MB/);
  for (const range of ['#L2-L1', '#L5', '#L1-L4']) {
    assert.throws(() => context([`backend/app/demo.py${range}`], directory), /Invalid line range/);
  }
});

test('directory links cannot expose files outside the workspace or bypass exclusions', t => {
  const { directory, write } = fixture(t);
  const outside = mkdtempSync(path.join(tmpdir(), 'private-context-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(path.join(outside, 'private.md'), 'PRIVATE');
  symlinkSync(outside, path.join(directory, 'outside'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => context(['outside/private.md'], directory), /linked target/);
  write('.cache/private.md', 'PRIVATE');
  symlinkSync(path.join(directory, '.cache'), path.join(directory, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => context(['alias/private.md'], directory), /linked target/);
});
