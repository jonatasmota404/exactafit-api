// Testes do hook PostToolUse de verificação no arquivo editado. Rodar: node --test '.claude/hooks/*.test.mjs'
// Cada caso monta um projeto temporário com .claude/verify.json e um arquivo editado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('./lint-on-edit.mjs', import.meta.url));

// `config`: objeto vira JSON, texto vai como está, undefined = sem verify.json. `files`: arquivos a criar.
const project = ({ config, files = ['src/a.js'] } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'lint-on-edit-'));
  const write = (f, c) => {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), c);
  };
  for (const f of files) write(f, 'x\n');
  if (config !== undefined) write('.claude/verify.json', typeof config === 'string' ? config : JSON.stringify(config));
  return dir;
};

const run = (dir, file_path) => {
  const r = spawnSync('node', [hook], {
    cwd: dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path } }),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, 'o hook sempre sai com 0; o bloqueio vai no JSON');
  return { out: r.stdout.trim() ? JSON.parse(r.stdout) : null, raw: r.stdout };
};

const ok = { name: 'lint', cmd: 'node -e "process.exit(0)" {file}', match: '\\.js$' };
const bad = { name: 'lint', cmd: 'node -e "console.error(\'erro de lint em \' + process.argv[1]); process.exit(1)" {file}', match: '\\.js$' };

test('sem verify.json: não faz nada', () => {
  assert.equal(run(project(), 'src/a.js').raw, '');
});

test('verify.json sem onEdit: não faz nada (o Stop continua cobrindo)', () => {
  assert.equal(run(project({ config: { checks: [] } }), 'src/a.js').raw, '');
});

test('verificação passa no arquivo editado: sem bloqueio e sem mensagem', () => {
  assert.equal(run(project({ config: { onEdit: [ok] } }), 'src/a.js').raw, '');
});

test('verificação falha no arquivo editado: bloqueia com nome, arquivo e saída', () => {
  const dir = project({ config: { onEdit: [bad] } });
  const { out } = run(dir, join(dir, 'src/a.js'));
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /lint falhou em src\/a\.js/);
  assert.match(out.reason, /erro de lint em src\/a\.js/);
});

test('arquivo que não casa com match: não roda, mesmo com comando que falharia', () => {
  const dir = project({ config: { onEdit: [bad] }, files: ['docs/x.md'] });
  assert.equal(run(dir, 'docs/x.md').raw, '');
});

test('sem match: roda em qualquer arquivo editado', () => {
  const dir = project({ config: { onEdit: [{ ...bad, match: undefined }] }, files: ['docs/x.md'] });
  assert.equal(run(dir, 'docs/x.md').out.decision, 'block');
});

test('arquivo fora do projeto: não faz nada', () => {
  const dir = project({ config: { onEdit: [{ ...bad, match: undefined }] } });
  assert.equal(run(dir, join(tmpdir(), 'fora.js')).raw, '');
});

test('arquivo que não existe mais: não faz nada', () => {
  assert.equal(run(project({ config: { onEdit: [bad] } }), 'src/apagado.js').raw, '');
});

test('caminho com espaço e aspas simples chega inteiro ao comando', () => {
  const name = "src/meu arquivo's.js";
  const check = { name: 'eco', cmd: `node -e "process.exit(process.argv[1] === ${JSON.stringify(name).replaceAll('"', '\\"')} ? 0 : 1)" {file}` };
  assert.equal(run(project({ config: { onEdit: [check] }, files: [name] }), name).raw, '');
});

test('comando sem {file}: o arquivo vai no fim', () => {
  const check = { name: 'fim', cmd: 'node -e "process.exit(process.argv[1] === \'src/a.js\' ? 0 : 1)"' };
  assert.equal(run(project({ config: { onEdit: [check] } }), 'src/a.js').raw, '');
});

test('onEdit inválido: avisa e não bloqueia', () => {
  const { out } = run(project({ config: { onEdit: { name: 'x' } } }), 'src/a.js');
  assert.equal(out.decision, undefined);
  assert.match(out.systemMessage, /onEdit inválido/);
});

test('regex inválida em match: avisa e não bloqueia', () => {
  const { out } = run(project({ config: { onEdit: [{ ...ok, match: '(' }] } }), 'src/a.js');
  assert.match(out.systemMessage, /onEdit inválido/);
});
