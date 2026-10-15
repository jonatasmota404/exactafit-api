// Testes do aviso de teste alterado. Rodar: node --test '.claude/hooks/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./test-warning.mjs', import.meta.url));

const SPEC = `describe('rota', () => {
  it('a', () => {
    expect(f(1)).toBe(1);
    expect(f(2)).toBe(2);
  });
  it('b', () => {
    expect(f(3)).toBe(3);
  });
});
`;

// Repositório com `main` (arquivos de `base`) e uma branch de trabalho onde `change(write, remove)` roda e vira commit.
const repo = ({ base = {}, change = () => {}, message = 'feat: x' } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'test-warning-'));
  const git = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
  const write = (f, c) => {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), c);
  };
  const remove = (f) => rmSync(join(dir, f));
  write('README.md', 'base\n');
  for (const [f, c] of Object.entries(base)) write(f, c);
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  git('switch', '-q', '-c', 'feat/x');
  change(write, remove);
  git('add', '-A');
  git('commit', '-q', '--allow-empty', '-m', message);
  return dir;
};

const warns = (dir) => {
  const r = spawnSync('node', [script], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, 'nunca falha');
  return r.stdout;
};

const withSpec = (spec, message) =>
  repo({ base: { 'src/a.spec.ts': SPEC }, change: (w) => w('src/a.spec.ts', spec), message });

test('sem mudança: sem aviso', () => assert.equal(warns(repo()), ''));

test('teste novo e código novo: sem aviso', () => {
  const dir = repo({ change: (w) => (w('src/b.spec.ts', SPEC), w('src/b.ts', 'x')) });
  assert.equal(warns(dir), '');
});

test('arquivo de teste apagado: avisa', () => {
  const dir = repo({ base: { 'src/a.spec.ts': SPEC }, change: (_, rm) => rm('src/a.spec.ts') });
  assert.match(warns(dir), /Aviso de testes: .*apagado.*src\/a\.spec\.ts/);
});

test('teste apagado e recriado em outro caminho (renomeado): sem aviso', () => {
  const dir = repo({
    base: { 'src/a.spec.ts': SPEC },
    change: (w, rm) => (rm('src/a.spec.ts'), w('src/b.spec.ts', SPEC)),
  });
  assert.equal(warns(dir), '');
});

for (const [label, line] of [
  ['it.skip', "  it.skip('c', () => {});"],
  ['test.todo', "  test.todo('c');"],
  ['describe.skip', "describe.skip('x', () => {});"],
  ['xit', "  xit('c', () => {});"],
  ['xdescribe', "xdescribe('x', () => {});"],
  ['it.only', "  it.only('c', () => {});"],
]) {
  test(`${label} adicionado: avisa`, () => {
    assert.match(warns(withSpec(`${SPEC}${line}\n`)), /Aviso de testes: .*desativ.*src\/a\.spec\.ts/);
  });
}

test('teste existente trocado por skip: avisa', () => {
  assert.match(warns(withSpec(SPEC.replace("it('b'", "it.skip('b'"))), /desativ/);
});

test('"skip" em texto comum não dispara', () => {
  const dir = withSpec(`${SPEC}// vamos skip esse caso? não\nconst nome = 'skipper';\n`);
  assert.equal(warns(dir), '');
});

test('menos verificações do que antes: avisa', () => {
  const weaker = SPEC.replace('    expect(f(2)).toBe(2);\n', '');
  assert.match(warns(withSpec(weaker)), /Aviso de testes: .*verificações.*src\/a\.spec\.ts \(-1\)/);
});

test('verificação alterada (uma sai, uma entra): sem aviso', () => {
  assert.equal(warns(withSpec(SPEC.replace('toBe(2)', 'toBe(4)'))), '');
});

test('verificações a mais: sem aviso', () => {
  assert.equal(warns(withSpec(`${SPEC}it('c', () => { expect(f(4)).toBe(4); });\n`)), '');
});

test('assert do node:test conta como verificação', () => {
  const base = "test('a', () => {\n  assert.equal(1, 1);\n  assert.equal(2, 2);\n});\n";
  const dir = repo({
    base: { 'test/a.test.mjs': base },
    change: (w) => w('test/a.test.mjs', "test('a', () => {\n  assert.equal(1, 1);\n});\n"),
  });
  assert.match(warns(dir), /verificações.*test\/a\.test\.mjs/);
});

test('arquivos que não são de teste não disparam', () => {
  const dir = repo({
    base: { 'src/a.ts': 'expect(1)\nexpect(2)\n' },
    change: (w) => w('src/a.ts', "it.skip('x')\n"),
  });
  assert.equal(warns(dir), '');
});

test('pasta test/ e __tests__/ e e2e-spec contam como teste', () => {
  for (const f of ['test/app.ts', 'src/__tests__/x.ts', 'test/app.e2e-spec.ts']) {
    const dir = repo({ base: { [f]: 'x\n' }, change: (_, rm) => rm(f) });
    assert.match(warns(dir), /apagado/, f);
  }
});

test('declaração "Teste alterado" no commit: sem aviso', () => {
  const dir = withSpec(SPEC.replace("it('b'", "it.skip('b'"), 'test: x\n\nTeste alterado: caso b duplicava o a');
  assert.equal(warns(dir), '');
});

test('declaração "Teste alterado" no plano: sem aviso', () => {
  const dir = repo({
    base: { 'src/a.spec.ts': SPEC },
    change: (w, rm) => (rm('src/a.spec.ts'), w('docs/plans/p.md', 'Teste alterado: arquivo substituído por e2e\n')),
  });
  assert.equal(warns(dir), '');
});

test('declaração com o texto-modelo "<motivo>" não vale', () => {
  const dir = withSpec(SPEC.replace("it('b'", "it.skip('b'"), 'test: x\n\nTeste alterado: <motivo>');
  assert.match(warns(dir), /desativ/);
});

test('mudança ainda sem commit (working tree) também é vista', () => {
  const dir = repo({ base: { 'src/a.spec.ts': SPEC } });
  writeFileSync(join(dir, 'src/a.spec.ts'), `${SPEC}it.skip('c', () => {});\n`);
  assert.match(warns(dir), /desativ/);
});

test('fora de um repositório git: não falha', () => {
  const dir = mkdtempSync(join(tmpdir(), 'test-warning-nogit-'));
  assert.equal(spawnSync('node', [script], { cwd: dir, encoding: 'utf8' }).status, 0);
});
