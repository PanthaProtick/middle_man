import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkRun } from './checks.mjs';
import { run } from './process.mjs';

function temporary(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'check-evidence-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('a failed gate records reached and unreached stages and propagates the exit code', t => {
  const directory = temporary(t);
  let reached = false;
  assert.throws(() => checkRun('check', [
    ['First', options => run(process.execPath, ['-e', 'console.log("first evidence")'], options)],
    ['Broken', options => run(process.execPath, ['-e', 'process.exit(7)'], options)],
    ['Unreached', () => { reached = true; }],
  ], directory), error => error.exitCode === 7);
  assert.equal(reached, false);
  const runDirectory = path.join(directory, readdirSync(directory)[0]);
  const result = JSON.parse(readFileSync(path.join(runDirectory, 'result.json'), 'utf8'));
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.stages.map(stage => stage.status), ['PASS', 'FAIL', 'NOT RUN']);
  assert.equal(result.stages[1].exitCode, 7);
  assert.ok(result.startedAt && result.finishedAt);
  assert.match(readFileSync(path.join(runDirectory, result.stages[0].log), 'utf8'), /first evidence/);
});

test('runs never reuse a previous result or log directory', t => {
  const directory = temporary(t);
  const first = checkRun('check', [['Probe', () => {}]], directory);
  const second = checkRun('check', [['Probe', () => {}]], directory);
  assert.notEqual(first, second);
  assert.equal(JSON.parse(readFileSync(first, 'utf8')).status, 'PASS');
  assert.equal(JSON.parse(readFileSync(second, 'utf8')).status, 'PASS');
});

test('the manifest marks an active stage before executing it', t => {
  const directory = temporary(t);
  checkRun('check:backend', [['Probe', () => {
    const runDirectory = path.join(directory, readdirSync(directory)[0]);
    const result = JSON.parse(readFileSync(path.join(runDirectory, 'result.json'), 'utf8'));
    assert.equal(result.status, 'RUNNING');
    assert.equal(result.stages[0].status, 'RUNNING');
    assert.equal(result.finishedAt, undefined);
  }]], directory);
});
