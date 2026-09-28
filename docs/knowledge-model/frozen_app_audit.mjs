// Reproduce historical app audits against pinned pre-fix consumers.
// Original evidence/data hashes remain enforced; pre-correction engine is pinned separately.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = new URL('fixtures/app-consumers-v1/', import.meta.url);
const strengthFixture = new URL('fixtures/strength-position-v1/', import.meta.url);
const hyeonchimFixture = new URL('fixtures/hyeonchim-consumers-v1/', import.meta.url);

export function frozenApp({ consumers = 'legacy' } = {}) {
  assert.ok(['legacy', 'unknown-time-v1', 'pre-hyeonchim-v1'].includes(consumers));
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
    linkChildren('.', ['.git', 'app', 'docs', 'dosa-app', ...(consumers === 'pre-hyeonchim-v1' ? ['정제'] : [])]);
    linkChildren('dosa-app', ['engine', ...(consumers === 'pre-hyeonchim-v1' ? ['methodology'] : [])]);
    if (consumers === 'pre-hyeonchim-v1')
      cpSync(resolve(root, 'dosa-app/methodology'), resolve(directory, 'dosa-app/methodology'), { recursive: true });
    linkChildren('dosa-app/engine', ['src']);
    cpSync(resolve(root, 'dosa-app/engine/src'), resolve(directory, 'dosa-app/engine/src'), { recursive: true });
    linkChildren('app', ['src']);
    cpSync(resolve(root, 'app/src'), resolve(directory, 'app/src'), { recursive: true });
    linkChildren('docs', ['knowledge-model']);
    // Copy scripts so import.meta.url and relative imports resolve inside this tree.
    cpSync(resolve(root, 'docs/knowledge-model'), resolve(directory, 'docs/knowledge-model'), {
      recursive: true, filter: path => !path.includes('/fixtures') && !path.includes('/__pycache__'),
    });
    symlinkSync(fileURLToPath(new URL('fixtures/', import.meta.url)),
      resolve(directory, 'docs/knowledge-model/fixtures'), 'junction');
    if (consumers === 'pre-hyeonchim-v1') {
      // The old source validator correctly rejects symlinks outside its root.
      // Copy its exact evidence bytes; do not weaken that boundary check.
      const review = JSON.parse(readFileSync(resolve(root, 'docs/knowledge-model/data/foundation_hyeonchim_review.json')));
      for (const path of new Set(review.evidence.map(e => e.path).filter(p => p.startsWith('정제/')))) {
        assert.ok(!path.includes('..'));
        mkdirSync(dirname(resolve(directory, path)), { recursive: true });
        cpSync(resolve(root, path), resolve(directory, path));
      }
    }
    const versions = [[hyeonchimFixture, '41fbb1f8f3ad0bc07daffac8b8a4fc4ee960063b']];
    if (consumers !== 'pre-hyeonchim-v1') versions.push([strengthFixture, '006d06c7bb0ee5281ebe94a170688709c48094db']);
    if (consumers === 'legacy') versions.push([fixture, 'd23400c3c8cc8587336fd5a00fcda2ce23184680']);
    for (const [source, commit] of versions) {
      const manifest = JSON.parse(readFileSync(new URL('manifest.json', source)));
      assert.equal(manifest.commit, commit);
      for (const { path, sha256_lf } of manifest.files) {
        assert.ok((path.startsWith('app/src/') || path.startsWith('dosa-app/engine/src/') ||
          path === 'docs/knowledge-model/test_hyeonchim_review.py') && !path.includes('..'));
        const src = new URL(path, source);
        const hash = createHash('sha256').update(readFileSync(src, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
        assert.equal(hash, sha256_lf, `Frozen consumer drift: ${path}`);
        mkdirSync(dirname(resolve(directory, path)), { recursive: true });
        cpSync(src, resolve(directory, path));
      }
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
