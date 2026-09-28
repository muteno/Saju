// Reproduce PR210 source review and PR207 delivery against exact pre-change bytes.
import { spawnSync } from 'node:child_process';
import { frozenApp } from './frozen_app_audit.mjs';
const frozen = frozenApp({ consumers: 'basic-sentences-v1' });
try {
  const args = process.argv.slice(2), python = args[0] === '--python';
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(python ? 'python3' : process.execPath, python ? args.slice(1) : args,
    { cwd: frozen.directory, env, encoding: 'utf8', timeout: 120000,
      maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(result.stdout ?? ''); process.stdout.write(result.stderr ?? '');
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Frozen audit exit ${result.status}`);
} catch (error) {
  console.error(error.stdout ?? '', error.stderr ?? '', error.message); process.exitCode = 1;
} finally { frozen.cleanup(); }
