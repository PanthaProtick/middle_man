import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root } from './process.mjs';

// A unique directory keeps concurrent checks and old logs from mixing evidence.
export function checkRun(task, steps, directory = path.join(root, '.cache', 'checks')) {
  mkdirSync(directory, { recursive: true });
  const logDirectory = mkdtempSync(path.join(directory, `${task.replaceAll(':', '-')}-`));
  const resultPath = path.join(logDirectory, 'result.json');
  const result = {
    task, startedAt: new Date().toISOString(), status: 'RUNNING',
    stages: steps.map(([name]) => ({ name, status: 'NOT RUN' })),
  };
  const save = () => {
    writeFileSync(`${resultPath}.tmp`, `${JSON.stringify(result, null, 2)}\n`);
    renameSync(`${resultPath}.tmp`, resultPath);
  };
  save();
  console.log(`Verification result: ${resultPath}`);
  try {
    for (const [index, [name, execute]] of steps.entries()) {
      const stage = result.stages[index];
      stage.status = 'RUNNING';
      stage.startedAt = new Date().toISOString();
      stage.log = `${name.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.log`;
      save();
      const started = performance.now();
      try {
        execute({ label: name, logDirectory });
        stage.status = 'PASS';
      } catch (error) {
        stage.status = 'FAIL';
        stage.exitCode = error.exitCode || 1;
        throw error;
      } finally {
        stage.durationMs = Math.round(performance.now() - started);
        save();
      }
    }
    result.status = 'PASS';
  } catch (error) {
    result.status = 'FAIL';
    throw error;
  } finally {
    result.finishedAt = new Date().toISOString();
    save();
  }
  return resultPath;
}
