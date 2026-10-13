// Testes do aviso de documentação. Rodar: node --test '.claude/hooks/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./doc-warning.mjs', import.meta.url));

// Cria um repositório com `main` e uma branch de trabalho; `files` entra no commit da branch.
const repo = (files = {}, message = 'feat: x') => {
  const dir = mkdtempSync(join(tmpdir(), 'doc-warning-'));
  const git = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
  const write = (f, c) => {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), c);
  };
  git('init', '-q', '-b', 'main');
  write('README.md', 'base\n');
  write('docs/domain.md', '# Domínio\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  git('switch', '-q', '-c', 'feat/x');
  for (const [f, c] of Object.entries(files)) write(f, c);
  git('add', '-A');
  git('commit', '-q', '--allow-empty', '-m', message);
  return dir;
};

const run = (dir) => spawnSync('node', [script], { cwd: dir, encoding: 'utf8' });
const warns = (dir) => {
  const r = run(dir);
  assert.equal(r.status, 0, 'nunca falha');
  return r.stdout;
};

test('sem mudança: sem aviso', () => assert.equal(warns(repo()), ''));

test('service sem doc: avisa', () => {
  assert.match(warns(repo({ 'src/routines/routine.service.ts': 'x' })), /código alterado sem doc/);
});

test('a mensagem manda atualizar domain.md ou ADR, não architecture.md', () => {
  const out = warns(repo({ 'src/routines/routine.service.ts': 'x' }));
  assert.match(out, /docs\/domain\.md ou um ADR/);
  assert.doesNotMatch(out, /architecture\.md/);
});

for (const f of [
  'src/auth/auth.controller.ts',
  'src/auth/dto/login.dto.ts',
  'prisma/schema.prisma',
  'prisma/migrations/2026_x/migration.sql',
]) {
  test(`avisa: ${f}`, () => assert.match(warns(repo({ [f]: 'x' })), /código alterado sem doc/));
}

test('spec e outros arquivos não disparam', () => {
  assert.equal(warns(repo({ 'src/routines/routine.service.spec.ts': 'x', 'src/main.ts': 'x' })), '');
});

test('service com domain.md alterado: sem aviso', () => {
  assert.equal(warns(repo({ 'src/routines/routine.service.ts': 'x', 'docs/domain.md': '# Domínio\nF1\n' })), '');
});

test('STATUS.md e RETRO.md não contam como doc do produto', () => {
  const out = warns(repo({ 'src/a.service.ts': 'x', 'docs/STATUS.md': 's', 'docs/RETRO.md': 'r' }));
  assert.match(out, /código alterado sem doc/);
});

test('declaração "Sem impacto em doc" no plano: sem aviso', () => {
  const out = warns(repo({ 'src/a.service.ts': 'x', 'docs/plans/p.md': 'Sem impacto em doc: refatoração interna\n' }));
  assert.equal(out, '');
});

test('declaração no commit: sem aviso', () => {
  const out = warns(repo({ 'src/a.service.ts': 'x' }, 'refactor: x\n\nSem impacto em doc: só renomeia variável'));
  assert.equal(out, '');
});

test('declaração com o texto-modelo "<motivo>" não vale', () => {
  const out = warns(repo({ 'src/a.service.ts': 'x', 'docs/plans/p.md': 'Sem impacto em doc: <motivo>\n' }));
  assert.match(out, /código alterado sem doc/);
});

test('link relativo quebrado: avisa', () => {
  assert.match(warns(repo({ 'docs/a.md': '[x](nao-existe.md)\n' })), /link quebrado em docs\/a\.md: nao-existe\.md/);
});

test('links válidos, externos, âncoras e código não avisam', () => {
  const md = '[a](domain.md#f1) [b](https://x.dev/y) [c](#topo) `[d](nada.md)`\n```\n[e](nada.md)\n```\n';
  assert.equal(warns(repo({ 'docs/a.md': md })), '');
});

test('número de ADR duplicado: avisa', () => {
  const out = warns(repo({ 'docs/adr/0004-a.md': '#', 'docs/adr/0004-b.md': '#' }));
  assert.match(out, /número de ADR duplicado 0004/);
});

test('ADRs com números distintos: sem aviso', () => {
  assert.equal(warns(repo({ 'docs/adr/0004-a.md': '#', 'docs/adr/0005-b.md': '#' })), '');
});

test('fora de um repositório git: não falha', () => {
  const dir = mkdtempSync(join(tmpdir(), 'doc-warning-nogit-'));
  assert.equal(run(dir).status, 0);
});
