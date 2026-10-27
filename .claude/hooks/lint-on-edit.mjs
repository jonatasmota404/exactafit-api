#!/usr/bin/env node
// PostToolUse (Write|Edit): roda as verificações rápidas de `onEdit` em .claude/verify.json só no arquivo editado.
// Formato: { "onEdit": [ { "name": "lint", "cmd": "<comando com {file}>", "match": "<regex do caminho>" } ] }.
// Falha devolve a saída ao modelo (decision: block) para corrigir na hora; o arquivo já foi gravado.
// Sem `onEdit`, sem arquivo ou arquivo fora do projeto: não faz nada.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const target = input.tool_input?.file_path;
if (!target) process.exit(0);

const file = relative(root, resolve(root, target));
if (file.startsWith('..') || isAbsolute(file) || !existsSync(resolve(root, file))) process.exit(0);

const CONFIG = resolve(root, '.claude/verify.json');
if (!existsSync(CONFIG)) process.exit(0);

let list;
try {
  list = JSON.parse(readFileSync(CONFIG, 'utf8')).onEdit;
  if (list === undefined) process.exit(0);
  const valid = (c) => c && typeof c.name === 'string' && typeof c.cmd === 'string' && (c.match === undefined || typeof c.match === 'string');
  if (!Array.isArray(list) || !list.every(valid)) throw new Error('"onEdit" deve ser uma lista de { name, cmd, match? } com textos');
  list.forEach((c) => c.match && new RegExp(c.match));
} catch (e) {
  console.log(JSON.stringify({ systemMessage: `⚠ .claude/verify.json → onEdit inválido; nada rodou no arquivo editado: ${e.message}` }));
  process.exit(0);
}

const quoted = `'${file.replaceAll("'", "'\\''")}'`;
const failures = [];
for (const c of list) {
  if (c.match && !new RegExp(c.match).test(file)) continue;
  const cmd = c.cmd.includes('{file}') ? c.cmd.replaceAll('{file}', quoted) : `${c.cmd} ${quoted}`;
  const r = spawnSync(cmd, { shell: true, cwd: root, encoding: 'utf8', maxBuffer: 1 << 24 });
  if (r.status !== 0) {
    const log = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-30).join('\n');
    failures.push(`### ${c.name} falhou em ${file} (\`${cmd}\`)\n${log}`);
  }
}

if (failures.length === 0) process.exit(0);
console.log(JSON.stringify({
  decision: 'block',
  reason: `Verificação rápida falhou no arquivo que você acabou de editar. Corrija antes de seguir.\n\n${failures.join('\n\n')}`,
}));
process.exit(0);
