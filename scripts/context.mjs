import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { root } from './process.mjs';

const MAX_BYTES = 24000;
const MAX_FILE_BYTES = 1000000;
const excluded = /^(?:\.git|\.cache|\.venv|node_modules|dist|build|__pycache__|\.agent-scratch|\.aws|\.ssh|\.codex|\.mypy_cache|\.pytest_cache|\.ruff_cache)$/i;
const secret = /(?:^\.env(?:\.|$)|\.env$|(?:^|[._-])(?:credentials?|secrets?)(?:[._-]|$)|\.(?:pem|key|p12|pfx)$)/i;
const textExtension = /\.(?:md|py|ts|tsx|css|json|toml|ya?ml|mjs|html|txt)$/i;
const plainNames = new Set(['.env.example', '.node-version', '.python-version', '.gitignore']);

function permitted(relative) {
  const parts = relative.split(/[\\/]/);
  return !parts.some(part => part.includes(':') || excluded.test(part) || (secret.test(part) && part !== '.env.example'))
    && !(parts[0].toLowerCase() === 'tasks' && parts[1]?.toLowerCase() === 'local')
    && (textExtension.test(relative) || plainNames.has(path.basename(relative)));
}

function inside(workspace, filename) {
  const relative = path.relative(workspace, filename);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function context(selections = [], workspace = root) {
  workspace = realpathSync(workspace);
  if (selections.length === 0) return inventory(workspace);
  let totalBytes = 0;
  const blocks = [...new Set(selections)].map(selection => {
    const match = /^(.*?)(?:#L([1-9]\d*)(?:-L([1-9]\d*))?)?$/.exec(selection);
    const [, filename, startValue, endValue] = match;
    const absolute = path.resolve(workspace, filename);
    if (!inside(workspace, absolute) || !permitted(path.relative(workspace, absolute))) {
      throw new Error(`Context refuses excluded or outside path: ${selection}`);
    }
    const resolved = realpathSync(absolute);
    if (!inside(workspace, resolved) || !permitted(path.relative(workspace, resolved))) {
      throw new Error(`Context refuses linked target: ${selection}`);
    }
    const info = statSync(resolved);
    if (!info.isFile() || info.size > MAX_FILE_BYTES) throw new Error(`Select a text file below 1 MB: ${selection}`);
    const bytes = readFileSync(resolved);
    if (bytes.includes(0)) throw new Error(`Context refuses binary content: ${selection}`);
    const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replaceAll('\r\n', '\n');
    const lines = source.split('\n');
    if (lines.at(-1) === '') lines.pop();
    const start = startValue ? Number(startValue) : 1;
    const end = endValue ? Number(endValue) : startValue ? start : lines.length;
    if ((lines.length || startValue) && (start > end || end > lines.length || start > lines.length)) {
      throw new Error(`Invalid line range: ${selection}`);
    }
    const relative = path.relative(workspace, absolute).replaceAll('\\', '/');
    const block = `\n--- ${relative} (${lines.length ? `${start}-${end} of ${lines.length} lines` : 'empty file'}) ---\n`
      + lines.slice(start - 1, end).map((line, index) => `${start + index}: ${line}`).join('\n') + '\n';
    totalBytes += Buffer.byteLength(block);
    if (totalBytes > MAX_BYTES) {
      throw new Error('Context exceeds 24 KB. Select fewer files or explicit path#L10-L40 ranges; nothing was emitted.');
    }
    return block;
  });
  return blocks.join('');
}

function inventory(workspace) {
  const files = [];
  const walk = relative => {
    if (files.length >= 150 || !existsSync(path.join(workspace, relative))) return;
    const info = lstatSync(path.join(workspace, relative));
    if (info.isSymbolicLink() || relative.split(/[\\/]/).some(part => excluded.test(part) || (secret.test(part) && part !== '.env.example'))
      || /^tasks[\\/]local(?:[\\/]|$)/i.test(relative)) return;
    if (info.isDirectory()) {
      for (const name of readdirSync(path.join(workspace, relative)).sort()) walk(path.join(relative, name));
    } else if (permitted(relative)) files.push(relative.replaceAll('\\', '/'));
  };
  for (const entry of ['AGENTS.md', 'README.md', 'package.json', '.node-version', '.github', 'backend/app',
    'backend/tests', 'backend/pyproject.toml', 'backend/.python-version', 'backend/.env.example',
    'frontend/src', 'frontend/package.json', 'frontend/tsconfig.json', 'frontend/vite.config.ts',
    'frontend/.env.example', 'scripts', 'docs', 'tasks']) walk(entry);
  const lines = [
    'Context map (paths only; read AGENTS.md first).',
    'Select complete files or quoted ranges: npm run context -- AGENTS.md "backend/app/api/routes.py#L1-L30"',
    'Output budget: 24 KB of UTF-8, not a model token limit. Common secret/generated paths are excluded.',
    'Imported skills: .agents/skills/<name>/SKILL.md (load only the matching skill).',
  ];
  let used = Buffer.byteLength(lines.join('\n')) + 1;
  for (const file of files) {
    used += Buffer.byteLength(file) + 1;
    if (used > MAX_BYTES - 100) break;
    lines.push(file);
  }
  if (lines.length - 4 < files.length || files.length >= 150) {
    lines.push('Map capped; use rg --files in the relevant directory.');
  }
  return lines.join('\n') + '\n';
}
