#!/usr/bin/env node
// Stop: roda typecheck, testes unitários e lint do projeto inteiro.
// Se algo falhar, bloqueia o encerramento e devolve a saída para o modelo corrigir.
// Na segunda tentativa seguida (stop_hook_active) libera, avisando o humano, para evitar loop.
import { readFileSync } from 'node:fs';
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
const warnings = (spawnSync('node', [docScript], { encoding: 'utf8' }).stdout ?? '').trim();

const checks = [
  ['typecheck', 'npm run typecheck'],
  ['testes unitários', 'npm test -- --silent'],
  ['lint', 'npm run lint:check'],
];

const failures = [];
for (const [name, cmd] of checks) {
  const r = sh(cmd);
  if (r.status !== 0) {
    const log = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');
    failures.push(`### ${name} falhou (\`${cmd}\`)\n${log}`);
  }
}

if (failures.length === 0) {
  if (warnings) console.log(JSON.stringify({ systemMessage: warnings }));
  process.exit(0);
}

if (input.stop_hook_active) {
  console.log(JSON.stringify({
    systemMessage:
      `⚠ Encerrado com verificações falhando: ${failures.map((f) => f.split('\n')[0].slice(4)).join('; ')}. Não está pronto.` +
      (warnings ? `\n${warnings}` : ''),
  }));
  process.exit(0);
}

console.log(JSON.stringify({
  ...(warnings && { systemMessage: warnings }),
  decision: 'block',
  reason:
    'Verificações falharam; a tarefa NÃO está pronta. Corrija e rode de novo. ' +
    'Se não for possível corrigir agora, diga explicitamente ao humano o que está falhando e não declare conclusão.\n\n' +
    failures.join('\n\n'),
}));
process.exit(0);
