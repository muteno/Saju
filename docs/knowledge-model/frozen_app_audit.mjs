// Reproduce historical app audits against pinned pre-fix consumers.
// Unchanged evidence/engine/data remain live and retain the original hash gates.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = new URL('fixtures/app-consumers-v1/', import.meta.url);

export function frozenApp() {
  const directory = mkdtempSync(resolve(tmpdir(), 'saju-frozen-app-'));
  const cleanup = () => rmSync(directory, { recursive: true, force: true });
  const linkChildren = (path, excluded) => {
    mkdirSync(resolve(directory, path), { recursive: true });
    for (const entry of readdirSync(resolve(root, path), { withFileTypes: true })) {
      if (!excluded.includes(entry.name)) symlinkSync(resolve(root, path, entry.name),
        resolve(directory, path, entry.name), entry.isDirectory() ? 'junction' : 'file');
    }
  };
  try {
    linkChildren('.', ['.git', 'app', 'docs']);
    linkChildren('app', ['src']);
    cpSync(resolve(root, 'app/src'), resolve(directory, 'app/src'), { recursive: true });
    linkChildren('docs', ['knowledge-model']);
    // Copy scripts so import.meta.url and relative imports resolve inside this tree.
    cpSync(resolve(root, 'docs/knowledge-model'), resolve(directory, 'docs/knowledge-model'), {
      recursive: true, filter: path => !path.includes('/fixtures') && !path.includes('/__pycache__'),
    });
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixture)));
    assert.equal(manifest.commit, 'd23400c3c8cc8587336fd5a00fcda2ce23184680');
    for (const { path, sha256_lf } of manifest.files) {
      assert.ok(path.startsWith('app/src/') && !path.includes('..'));
      const src = new URL(path, fixture);
      const hash = createHash('sha256').update(readFileSync(src, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
      assert.equal(hash, sha256_lf, `Frozen consumer drift: ${path}`);
      mkdirSync(dirname(resolve(directory, path)), { recursive: true });
      cpSync(src, resolve(directory, path));
    }
    return { directory, cleanup };
  } catch (error) { cleanup(); throw error; }
}

export function runFrozenAudit(args, timeout = 90000) {
  const { directory, cleanup } = frozenApp();
  try {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    return execFileSync(process.execPath, args, { cwd: directory, env, encoding: 'utf8',
      timeout, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } finally { cleanup(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(runFrozenAudit(process.argv.slice(2))); }
  catch (error) { console.error(error.stdout ?? '', error.stderr ?? '', error.message); process.exitCode = 1; }
}
