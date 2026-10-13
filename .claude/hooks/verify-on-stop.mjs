#!/usr/bin/env node
// Stop: roda as verificações configuradas em .claude/verify.json (typecheck, testes, lint...).
// Se algo falhar, bloqueia o encerramento e devolve a saída para o modelo corrigir.
// Na segunda tentativa seguida (stop_hook_active) libera, avisando o humano, para evitar loop.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const sh = (c) => spawnSync(c, { shell: true, encoding: 'utf8', maxBuffer: 1 << 26 });
const out = (c) => sh(c).stdout?.trim() ?? '';

const base = out('git merge-base HEAD main 2>/dev/null') || 'HEAD';
const changed = [
  ...out(`git diff --name-only --diff-filter=ACMR ${base}`).split('\n'),
  ...out('git ls-files --others --exclude-standard').split('\n'),
].filter(Boolean);

// Nada alterado na branch nem no working tree: nada a verificar.
if (changed.length === 0) process.exit(0);

// Aviso de documentação: só informa, nunca bloqueia (falha do script é ignorada).
const docScript = fileURLToPath(new URL('./doc-warning.mjs', import.meta.url));
const docWarnings = (spawnSync('node', [docScript], { encoding: 'utf8' }).stdout ?? '').trim();
const warnings = docWarnings ? [docWarnings] : [];

// Comandos do projeto: .claude/verify.json, relativo ao diretório do projeto (o hook roda com cwd nele).
// Formato: { "checks": [ { "name": "typecheck", "cmd": "<comando>" } ] }. Ver PROJECT-ADJUST.md.
const CONFIG = '.claude/verify.json';
const failures = [];
let checks = [];
if (!existsSync(CONFIG)) {
  warnings.push(`⚠ ${CONFIG} ausente: nenhuma verificação rodou. Configure os comandos do projeto (PROJECT-ADJUST.md).`);
} else {
  try {
    const list = JSON.parse(readFileSync(CONFIG, 'utf8')).checks;
    if (!Array.isArray(list) || !list.every((c) => c && typeof c.name === 'string' && typeof c.cmd === 'string')) {
      throw new Error('"checks" deve ser uma lista de { name, cmd } com textos');
    }
    checks = list.map((c) => [c.name, c.cmd]);
    if (checks.length === 0) warnings.push(`⚠ ${CONFIG} sem verificações: nada foi conferido.`);
  } catch (e) {
    failures.push(`### configuração inválida (\`${CONFIG}\`)\n${e.message}`);
  }
}

for (const [name, cmd] of checks) {
  const r = sh(cmd);
  if (r.status !== 0) {
    const log = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');
    failures.push(`### ${name} falhou (\`${cmd}\`)\n${log}`);
  }
}

const warning = warnings.join('\n');

if (failures.length === 0) {
  if (warning) console.log(JSON.stringify({ systemMessage: warning }));
  process.exit(0);
}

if (input.stop_hook_active) {
  console.log(JSON.stringify({
    systemMessage:
      `⚠ Encerrado com verificações falhando: ${failures.map((f) => f.split('\n')[0].slice(4)).join('; ')}. Não está pronto.` +
      (warning ? `\n${warning}` : ''),
  }));
  process.exit(0);
}

console.log(JSON.stringify({
  ...(warning && { systemMessage: warning }),
  decision: 'block',
  reason:
    'Verificações falharam; a tarefa NÃO está pronta. Corrija e rode de novo. ' +
    'Se não for possível corrigir agora, diga explicitamente ao humano o que está falhando e não declare conclusão.\n\n' +
    failures.join('\n\n'),
}));
process.exit(0);
