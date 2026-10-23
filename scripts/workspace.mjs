import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { backend, backendEnvironment, frontend, root, run, runSteps } from './process.mjs';
import { checkRun } from './checks.mjs';
import { context } from './context.mjs';

const [task, ...args] = process.argv.slice(2);
const lintBackend = (options = {}) => backend(['ruff', 'check', '.', '../scripts'], options);
const typecheckBackend = (options = {}) => backend(['mypy', 'app'], options);
const testBackend = (options = {}) => backend(['pytest', ...args], options);
const testTooling = (options = {}) => run(process.execPath, ['--test',
  ...readdirSync(path.join(root, 'scripts')).filter(name => name.endsWith('.test.mjs')).map(name => `scripts/${name}`),
], options);
const smoke = (options = {}) => backend(['python', '../scripts/smoke.py'], {
  ...options,
  env: { ...backendEnvironment(), ...(options.logDirectory ? { SMOKE_LOG_DIRECTORY: options.logDirectory } : {}) },
});
const backendChecks = [['Backend lint', lintBackend], ['Backend types', typecheckBackend], ['Backend tests', testBackend]];
const frontendChecks = ['lint', 'test', 'build'].map(command => [
  `Frontend ${command}`, options => frontend(['run', command], options),
]);

function doctor() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (!(major >= 22 && (major !== 22 || minor >= 12))) {
    throw new Error('Use Node.js 22.12 or newer (Node 22 LTS recommended).');
  }
  console.log(`Node ${process.versions.node}`);
  run('uv', ['--version']);
  for (const file of ['backend/uv.lock', 'frontend/package-lock.json']) {
    if (!existsSync(path.join(root, file))) throw new Error(`Missing lockfile: ${file}`);
  }
  const python = process.platform === 'win32' ? 'backend/.venv/Scripts/python.exe' : 'backend/.venv/bin/python';
  if (!existsSync(path.join(root, python)) || !existsSync(path.join(root, 'frontend/node_modules'))) {
    throw new Error('Dependencies are missing. Run npm run setup.');
  }
  run(path.join(root, python), ['-c', 'import sys; print("Python", sys.version.split()[0]); sys.exit(0 if sys.version_info >= (3, 12) else 1)']);
  console.log(`uv cache: ${backendEnvironment().UV_CACHE_DIR}`);
  run(path.join(root, python), ['-c', 'from importlib.metadata import version; [version(p) for p in ("fastapi", "ruff", "mypy", "pytest", "httpx", "uvicorn", "google-genai", "sqlalchemy", "asyncpg", "pydantic-settings")]; print("Backend packages available")']);
  run(process.execPath, [path.join(root, 'frontend/node_modules/typescript/bin/tsc'), '--version']);
  console.log('Preflight passed. Run npm run check to verify behavior. No credentials are needed for tests.');
}

const tasks = {
  doctor,
  context: () => console.log(context(args)),
  setup: () => runSteps([
    () => run('uv', ['sync', '--locked', '--all-groups'], { cwd: path.join(root, 'backend'), env: backendEnvironment() }),
    () => frontend(['ci']),
  ]),
  check: () => checkRun(task, [['Tooling tests', testTooling], ...backendChecks, ...frontendChecks, ['HTTP smoke', smoke]]),
  smoke,
  'check:backend': () => checkRun(task, backendChecks),
  'check:frontend': () => checkRun(task, frontendChecks),
  'test:tooling': testTooling,
  test: () => runSteps([testTooling, testBackend, () => frontend(['run', 'test', '--', ...args])]),
  'test:backend': testBackend,
  'test:frontend': () => frontend(['run', 'test', '--', ...args]),
  'audit:frontend': () => frontend(['audit', '--audit-level=high']),
  lint: () => runSteps([lintBackend, () => frontend(['run', 'lint'])]),
  'lint:backend': lintBackend,
  'lint:frontend': () => frontend(['run', 'lint']),
  typecheck: () => runSteps([typecheckBackend, () => frontend(['run', 'typecheck'])]),
  'typecheck:backend': typecheckBackend,
  'typecheck:frontend': () => frontend(['run', 'typecheck']),
  build: () => frontend(['run', 'build']),
  'dev:backend': () => backend(['uvicorn', 'app.main:app', '--reload', '--port', '8000', '--no-access-log']),
  'dev:frontend': () => frontend(['run', 'dev']),
};

try {
  if (!Object.hasOwn(tasks, task)) throw new Error(`Unknown workspace task: ${task}`);
  if (args.length && (task === 'check' || task.startsWith('check:'))) {
    throw new Error('Check gates do not accept filters. Use test:backend or test:frontend for focused tests.');
  }
  tasks[task]();
} catch (error) {
  console.error(error.message);
  process.exitCode = error.exitCode || 1;
}
