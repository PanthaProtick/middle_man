import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));

export function backendEnvironment(environment = process.env) {
  return { ...environment, UV_CACHE_DIR: environment.UV_CACHE_DIR || path.join(root, '.cache', 'uv') };
}

export function run(command, args, options = {}) {
  const { label, logDirectory = path.join(root, '.cache', 'checks'), ...spawnOptions } = options;
  let descriptor;
  let logPath;
  if (label) {
    mkdirSync(logDirectory, { recursive: true });
    logPath = path.join(logDirectory, `${label.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.log`);
    descriptor = openSync(logPath, 'w');
  }
  const started = performance.now();
  let result;
  try {
    result = spawnSync(command, args, {
      cwd: root, ...spawnOptions,
      stdio: label ? ['ignore', descriptor, descriptor] : 'inherit',
    });
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const failed = result.error || result.status !== 0;
  if (label && (failed || process.env.CHECK_VERBOSE === '1')) {
    const log = openSync(logPath, 'r');
    try {
      const size = statSync(logPath).size;
      const tail = Buffer.alloc(Math.min(size, 16000));
      readSync(log, tail, 0, tail.length, size - tail.length);
      console.error(`${label}: ${logPath}${size > tail.length ? ' (last 16 KB)' : ''}\n${tail.toString('utf8')}`);
    } finally {
      closeSync(log);
    }
  }
  if (result.error) throw new Error(`Could not start ${command}: ${result.error.message}`);
  if (result.status !== 0) {
    const error = new Error(`${command} failed (${result.signal || result.status}).`);
    error.exitCode = result.status || 1;
    throw error;
  }
  if (label) console.log(`PASS ${label} (${((performance.now() - started) / 1000).toFixed(1)}s)`);
}

export function runSteps(steps) {
  for (const step of steps) step();
}

export function backend(args, options = {}) {
  run('uv', ['run', '--locked', ...args], {
    cwd: path.join(root, 'backend'), env: backendEnvironment(), ...options,
  });
}

export function frontend(args, options = {}) {
  if (!process.env.npm_execpath) throw new Error('Run this command through npm from the workspace root.');
  run(process.execPath, [process.env.npm_execpath, ...args], { cwd: path.join(root, 'frontend'), ...options });
}
