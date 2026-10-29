import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { root } from './process.mjs';

export const REVIEW_LINES = 250;
export const MAXIMUM_LINES = 300;

const sourceRoots = ['backend/app', 'backend/tests', 'frontend/src', 'scripts'];
const sourceExtensions = new Set(['.py', '.ts', '.tsx', '.mjs', '.css']);
const maintainedDocument = /^(?:README\.md|AGENTS\.md|docs\/.+\.md|tasks\/.+\.md)$/i;
const excludedDocument = /^(?:\.scratch|\.agents|node_modules)\//i;
const testFile = /^(?:backend\/tests\/|scripts\/.+\.test\.mjs$)|(?:\.test\.[^/]+$)/i;
const linkPattern = /!?\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;
const npmRunPattern = /\bnpm run ([a-z][a-z0-9:._-]*)/gi;

// Narrow, documented test exceptions live here as path -> retained scenario.
// No file currently needs one; add an exception only with the owning ticket.
export const sizeExceptions = new Map();

export function isSource(file) {
  return sourceRoots.some(directory => file.startsWith(`${directory}/`))
    && sourceExtensions.has(path.extname(file).toLowerCase());
}

export function isMaintainedDocument(file) {
  return maintainedDocument.test(file) && !excludedDocument.test(file);
}

export function lineCount(source) {
  const lines = source.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines.length;
}

export function scratchFindings(files) {
  return files
    .filter(file => file.startsWith('.scratch/') && !file.toLowerCase().endsWith('.md'))
    .map(file => `${file}: tracked scratch files must be Markdown work records; use .cache/ or docs/verification/ for other output`);
}

export function sizeFindings(files, exceptions = sizeExceptions) {
  const failures = [];
  const reviews = [];
  const allowed = [];
  for (const { path: file, lines } of files) {
    if (!isSource(file)) continue;
    if (lines > MAXIMUM_LINES) {
      const reason = exceptions.get(file);
      if (testFile.test(file) && typeof reason === 'string' && reason.trim()) {
        allowed.push(`${file} (${lines}): ${reason}`);
      } else {
        failures.push(`${file} is ${lines} physical lines (maximum ${MAXIMUM_LINES}); decompose by responsibility or record a narrow test exception`);
      }
    } else if (lines >= REVIEW_LINES) {
      reviews.push(`${file} (${lines})`);
    }
  }
  return { failures, reviews, allowed };
}

export function brokenLinks(workspace, files) {
  const findings = [];
  for (const file of files) {
    const source = readFileSync(path.join(workspace, file), 'utf8');
    for (const match of source.matchAll(linkPattern)) {
      const target = match[1].replace(/^<|>$/g, '');
      if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) continue;
      const relative = target.split('#')[0].split('?')[0];
      if (!relative) continue;
      const resolved = relative.startsWith('/')
        ? path.join(workspace, relative)
        : path.resolve(path.dirname(path.join(workspace, file)), relative);
      if (!existsSync(resolved)) findings.push(`${file}: link target does not exist: ${target}`);
    }
  }
  return findings;
}

export function commandFindings(workspace, files) {
  const manifest = JSON.parse(readFileSync(path.join(workspace, 'package.json'), 'utf8'));
  const scripts = new Set(Object.keys(manifest.scripts ?? {}));
  const findings = [];
  for (const file of files) {
    const source = readFileSync(path.join(workspace, file), 'utf8');
    for (const match of source.matchAll(npmRunPattern)) {
      if (!scripts.has(match[1])) findings.push(`${file}: npm run ${match[1]} is not a package.json script`);
    }
  }
  return findings;
}

export function trackedFiles(workspace) {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: workspace, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
      .map(file => file.replaceAll('\\', '/'));
  } catch {
    throw new Error('Repository conventions need a Git checkout to list tracked files.');
  }
}

export function checkConventions({ workspace = root, files = trackedFiles(workspace), exceptions = sizeExceptions } = {}) {
  const findings = [...scratchFindings(files)];
  const sources = files.filter(isSource).map(file => ({
    path: file,
    lines: lineCount(readFileSync(path.join(workspace, file), 'utf8')),
  }));
  const size = sizeFindings(sources, exceptions);
  findings.push(...size.failures);
  const documents = files.filter(isMaintainedDocument);
  findings.push(...brokenLinks(workspace, documents));
  findings.push(...commandFindings(workspace, documents));
  return { checked: files.length, findings, review: size.reviews, exceptions: size.allowed };
}

export function conventions({ workspace = root, files } = {}) {
  const report = checkConventions({ workspace, files });
  if (report.findings.length) {
    throw new Error(`Repository conventions failed:\n- ${report.findings.join('\n- ')}`);
  }
  const detail = process.env.CHECK_VERBOSE === '1' && report.review.length
    ? `\n${report.review.map(file => `  ${file}`).join('\n')}`
    : '';
  console.log(`Repository conventions passed: ${report.checked} tracked files; ${report.review.length} at the ${REVIEW_LINES}-line review trigger.${detail}`);
}
