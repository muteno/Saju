// PR213/214's exact report/card consumers for the historical delivery receipt.
import { spawnSync } from 'node:child_process';
import { frozenApp } from './frozen_app_audit.mjs';
const frozen = frozenApp({ consumers: 'gapin-structure-v1' });
try {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, process.argv.slice(2), {
    cwd: frozen.directory, env, encoding: 'utf8', timeout: 150000,
    maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Frozen structure exit ${result.status}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { frozen.cleanup(); }
