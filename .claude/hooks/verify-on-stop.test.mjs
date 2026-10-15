// Testes do hook Stop de verificação. Rodar: node --test '.claude/hooks/*.test.mjs'
// O hook lê os comandos de .claude/verify.json do diretório do projeto; aqui cada caso monta um projeto temporário.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('./verify-on-stop.mjs', import.meta.url));

// Repositório com `main` e uma branch de trabalho. `config` é o conteúdo de .claude/verify.json
// (objeto vira JSON; texto vai como está; undefined = sem arquivo). `dirty` cria um arquivo novo.
const project = ({ config, dirty = true } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'verify-on-stop-'));
  const git = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
  const write = (f, c) => {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), c);
  };
  git('init', '-q', '-b', 'main');
  write('README.md', 'base\n');
  if (config !== undefined) write('.claude/verify.json', typeof config === 'string' ? config : JSON.stringify(config));
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  git('switch', '-q', '-c', 'feat/x');
  if (dirty) write('mudanca.txt', 'x\n');
  return dir;
};

const run = (dir, input = {}) => {
  const r = spawnSync('node', [hook], { cwd: dir, input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(r.status, 0, 'o hook sempre sai com 0; o bloqueio vai no JSON');
  return { out: r.stdout.trim() ? JSON.parse(r.stdout) : null, raw: r.stdout };
};

const ok = { name: 'ok', cmd: 'node -e "process.exit(0)"' };
const bad = { name: 'quebrado', cmd: 'node -e "console.error(\'falhou aqui\'); process.exit(1)"' };

test('sem alterações: não roda nada e não fala nada', () => {
  const dir = project({ config: { checks: [bad] }, dirty: false });
  assert.equal(run(dir).raw, '');
});

test('todas as verificações passam: sem bloqueio e sem mensagem', () => {
  assert.equal(run(project({ config: { checks: [ok, ok] } })).raw, '');
});

test('verificação falha: bloqueia e devolve o nome, o comando e a saída', () => {
  const { out } = run(project({ config: { checks: [ok, bad] } }));
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /quebrado falhou/);
  assert.match(out.reason, /falhou aqui/);
  assert.doesNotMatch(out.reason, /### ok falhou/);
});

test('roda todas e lista cada falha', () => {
  const { out } = run(project({ config: { checks: [bad, { ...bad, name: 'outro' }] } }));
  assert.match(out.reason, /quebrado falhou/);
  assert.match(out.reason, /outro falhou/);
});

test('segunda tentativa (stop_hook_active): libera e só avisa', () => {
  const { out } = run(project({ config: { checks: [bad] } }), { stop_hook_active: true });
  assert.equal(out.decision, undefined);
  assert.match(out.systemMessage, /Encerrado com verificações falhando: quebrado falhou/);
  assert.match(out.systemMessage, /Não está pronto/);
});

test('usa os comandos do projeto, quaisquer que sejam', () => {
  const dir = project({ config: { checks: [{ name: 'make check', cmd: 'node -e "process.exit(3)"' }] } });
  assert.match(run(dir).out.reason, /make check falhou \(`node -e/);
});

test('sem .claude/verify.json: não bloqueia, mas avisa que nada rodou', () => {
  const { out } = run(project());
  assert.equal(out.decision, undefined);
  assert.match(out.systemMessage, /verify\.json ausente: nenhuma verificação rodou/);
});

test('lista de verificações vazia: avisa', () => {
  assert.match(run(project({ config: { checks: [] } })).out.systemMessage, /sem verificações/);
});

for (const [label, config] of [
  ['JSON malformado', '{ checks: '],
  ['checks não é lista', { checks: 'npm test' }],
  ['item sem cmd', { checks: [{ name: 'x' }] }],
]) {
  test(`configuração inválida (${label}): bloqueia`, () => {
    const { out } = run(project({ config }));
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /configuração inválida/);
  });
}

test('teste apagado na branch: avisa, sem bloquear', () => {
  const dir = project({ config: { checks: [ok] }, dirty: false });
  const git = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
  git('switch', '-q', 'main');
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src/a.spec.ts'), "it('a', () => { expect(1).toBe(1); });\n");
  git('add', '-A');
  git('commit', '-q', '-m', 'teste');
  git('switch', '-q', 'feat/x');
  git('merge', '-q', 'main');
  git('rm', '-q', 'src/a.spec.ts');
  git('commit', '-q', '-m', 'remove');
  const { out } = run(dir);
  assert.equal(out.decision, undefined);
  assert.match(out.systemMessage, /Aviso de testes: .*apagado.*src\/a\.spec\.ts/);
});
