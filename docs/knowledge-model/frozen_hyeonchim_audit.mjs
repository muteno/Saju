// Historical PR206 source/consumer checks run against their exact baseline files.
import { execFileSync } from 'node:child_process';
import { frozenApp } from './frozen_app_audit.mjs';

const frozen = frozenApp({ consumers: 'pre-hyeonchim-v1' });
try {
  const args = process.argv.slice(2), python = args[0] === '--python';
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  process.stdout.write(execFileSync(python ? 'python3' : process.execPath, python ? args.slice(1) : args,
    { cwd: frozen.directory, env, encoding: 'utf8', timeout: 90000,
      maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
} catch (error) {
  console.error(error.stdout ?? '', error.stderr ?? '', error.message); process.exitCode = 1;
} finally { frozen.cleanup(); }
