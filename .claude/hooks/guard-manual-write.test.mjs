// Testes do hook guard-manual-write. Rodar: node --test '.claude/hooks/*.test.mjs'
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('./guard-manual-write.mjs', import.meta.url));
let root;
let project;
let manual;

before(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'guard-manual-')));
  project = join(root, 'projeto');
  manual = join(root, 'manual');
  mkdirSync(join(project, 'src'), { recursive: true });
  mkdirSync(manual);
  symlinkSync(project, join(manual, 'atalho')); // link do manual para dentro do projeto
  symlinkSync(join(project, 'src'), join(manual, 'atalho-src'));
});

const run = (tool_input, { cwd = project, env = true } = {}) =>
  spawnSync('node', [hook], {
    input: JSON.stringify({ tool_name: 'Write', tool_input, cwd }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: env ? project : '' },
    encoding: 'utf8',
  });

const blocked = (r) => {
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /guard-manual-write/);
};

test('caminho absoluto dentro do projeto: bloqueia', () => {
  blocked(run({ file_path: join(project, 'src/a.ts') }));
});

test('caminho relativo (cwd é o projeto): bloqueia', () => {
  blocked(run({ file_path: 'docs/domain.md' }));
});

test('.. que escapa para fora do projeto: permite', () => {
  assert.equal(run({ file_path: '../manual/index.md' }).status, 0);
});

test('.. que sai e volta para dentro do projeto: bloqueia', () => {
  blocked(run({ file_path: join(manual, '..', 'projeto', 'src', 'a.ts') }));
});

test('nome que começa com ".." dentro do projeto (..dados): bloqueia', () => {
  blocked(run({ file_path: join(project, '..dados', 'x') }));
});

test('../manual/x, fora do projeto: permite', () => {
  assert.equal(run({ file_path: join(project, '..', 'manual', 'x') }).status, 0);
});

test('caminho fora do projeto: permite', () => {
  assert.equal(run({ file_path: join(manual, 'STATUS.md') }).status, 0);
});

test('link simbólico no manual apontando para dentro do projeto: bloqueia', () => {
  blocked(run({ file_path: join(manual, 'atalho', 'src', 'a.ts') }));
  blocked(run({ file_path: join(manual, 'atalho-src', 'novo', 'b.ts') }));
});

test('sem file_path: permite (nada a escrever)', () => {
  assert.equal(run({}).status, 0);
});

test('sem CLAUDE_PROJECT_DIR, vale o cwd', () => {
  blocked(run({ file_path: 'src/a.ts' }, { env: false }));
  assert.equal(run({ file_path: join(manual, 'x.md') }, { env: false }).status, 0);
});

test('entrada ilegível: bloqueia', () => {
  const r = spawnSync('node', [hook], { input: 'não é json', encoding: 'utf8' });
  assert.equal(r.status, 2);
});
