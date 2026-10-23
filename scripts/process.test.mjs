import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { backendEnvironment, root, run, runSteps } from './process.mjs';

test('a failed subprocess stops subsequent steps and preserves its exit code', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'agent-runner-'));
  const marker = path.join(directory, 'should-not-exist');
  try {
    assert.throws(() => runSteps([
      () => run(process.execPath, ['-e', 'process.exit(7)']),
      () => run(process.execPath, ['-e', 'require("node:fs").writeFileSync(process.argv[1], "bad")', marker]),
    ]), error => error.exitCode === 7);
    assert.equal(existsSync(marker), false);
  } finally {
    rmSync(marker, { force: true });
    rmdirSync(directory);
  }
});

test('missing executables fail instead of reporting success', () => {
  assert.throws(() => run('nonexistent-agent-tool-7e1294', []), /Could not start/);
});

test('the workspace command rejects unknown tasks with a failing exit status', () => {
  const result = spawnSync(process.execPath, ['scripts/workspace.mjs', 'constructor'], {
    cwd: root, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown workspace task/);
});

test('complete check gates reject filters instead of silently narrowing acceptance', () => {
  for (const task of ['check', 'check:backend', 'check:frontend']) {
    const result = spawnSync(process.execPath, ['scripts/workspace.mjs', task, '-k', 'one_test'], {
      cwd: root, encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /do not accept filters/);
  }
});

test('backend cache defaults inside the workspace and honors explicit configuration', () => {
  const original = { UV_OFFLINE: 'true' };
  const environment = backendEnvironment(original);
  assert.equal(environment.UV_CACHE_DIR, path.join(root, '.cache', 'uv'));
  assert.equal(environment.UV_OFFLINE, 'true');
  assert.equal(original.UV_CACHE_DIR, undefined);
  assert.equal(backendEnvironment({ UV_CACHE_DIR: '/custom/cache' }).UV_CACHE_DIR, '/custom/cache');
});

test('subprocess arguments and environment survive spaces without shell interpretation', () => {
  run(process.execPath, ['-e', 'const a=require("node:assert/strict");a.equal(process.argv[1],"space & $value");a.equal(process.env.AGENT_TEST,"ok")', 'space & $value'], {
    env: { ...process.env, AGENT_TEST: 'ok' },
  });
});

function capturedStage(script, directory) {
  const moduleUrl = new URL('./process.mjs', import.meta.url).href;
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { run } from ${JSON.stringify(moduleUrl)};
    try {
      run(process.execPath, ['-e', ${JSON.stringify(script)}], {
        label: 'Probe stage', logDirectory: ${JSON.stringify(directory)},
      });
    } catch (error) {
      console.error(error.message);
      process.exitCode = error.exitCode || 1;
    }
  `], { encoding: 'utf8', env: { ...process.env, CHECK_VERBOSE: '0' } });
}

function stageDirectory(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'agent-stage-'));
  t.after(() => {
    rmSync(path.join(directory, 'probe-stage.log'), { force: true });
    rmdirSync(directory);
  });
  return directory;
}

test('successful stages retain full output but only print a compact summary', t => {
  const directory = stageDirectory(t);
  const result = capturedStage('console.log("success detail"); console.error("stderr detail")', directory);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^PASS Probe stage/);
  assert.doesNotMatch(result.stdout, /success detail/);
  assert.equal(result.stderr, '');
  const log = readFileSync(path.join(directory, 'probe-stage.log'), 'utf8');
  assert.match(log, /success detail/);
  assert.match(log, /stderr detail/);
});

test('failed stages preserve the full log, show a bounded tail, and keep the exit code', t => {
  const directory = stageDirectory(t);
  const result = capturedStage('process.stdout.write("BEGIN" + "x".repeat(30000)); console.error("failure diagnostic"); process.exit(9)', directory);
  assert.equal(result.status, 9);
  assert.doesNotMatch(result.stdout, /PASS/);
  assert.match(result.stderr, /last 16 KB/);
  assert.match(result.stderr, /failure diagnostic/);
  assert.ok(result.stderr.length < 17000);
  const log = readFileSync(path.join(directory, 'probe-stage.log'), 'utf8');
  assert.ok(log.startsWith('BEGIN'));
  assert.ok(log.length > 30000);
});
