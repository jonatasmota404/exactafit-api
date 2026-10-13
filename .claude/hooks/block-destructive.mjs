#!/usr/bin/env node
// PreToolUse(Bash): bloqueia comandos destrutivos e leitura de segredos.
// Exit 2 = bloqueia a chamada; a mensagem em stderr volta para o modelo.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const cmd = input?.tool_input?.command ?? '';

const rules = [
  [/\brm\s+(-\S*\s+)*-\S*(r\S*f|f\S*r)/i, 'rm recursivo forçado'],
  [/\brm\s+(-\S+\s+)*-(r|R|-recursive)\b.*\s-(f|-force)\b/, 'rm recursivo forçado'],
  [/\brm\s+(-\S+\s+)*-(f|-force)\b.*\s-(r|R|-recursive)\b/, 'rm recursivo forçado'],
  [/\bgit\s+push\b.*(\s--force(-with-lease)?\b|\s-f\b|\s\+\S)/, 'git push forçado'],
  [/\bgit\s+reset\s+.*--hard\b/, 'git reset --hard'],
  [/\bgit\s+clean\s+.*-\S*f/, 'git clean -f'],
  // Remoção forçada de branch: -D (ou qualquer flag curta com D) e -d junto de -f/--force.
  [/\bgit\b[^|;&\n]*\sbranch\b[^|;&\n]*\s-[a-zA-Z]*D[a-zA-Z]*(?=\s|$)/, 'git branch -D (remoção forçada de branch)'],
  [
    /\bgit\b[^|;&\n]*\sbranch\b(?=[^|;&\n]*\s(?:--delete|-[a-zA-Z]*d[a-zA-Z]*)(?=\s|$))(?=[^|;&\n]*\s(?:--force|-[a-zA-Z]*f[a-zA-Z]*)(?=\s|$))/,
    'git branch -d --force (remoção forçada de branch)',
  ],
  [/\b(drop\s+(table|database|schema)|truncate\s+table)\b/i, 'SQL destrutivo'],
  [/\bdocker(-compose|\s+compose)\s+down\b.*\s-(v|-volumes)\b/, 'remoção de volume do banco'],
  [/\bdocker\s+volume\s+(rm|prune)\b/, 'remoção de volume do banco'],
  // AJUSTAR (projeto): comandos destrutivos da stack, ex. reset de banco por CLI. Ver PROJECT-ADJUST.md.
  [/\bprisma\s+migrate\s+reset\b/, 'prisma migrate reset (apaga o banco)'],
  [/\bprisma\s+db\s+push\b.*--(force-reset|accept-data-loss)\b/, 'prisma db push destrutivo'],
  [/(^|[\s'"=<>:/])\.env(?!\.example\b)(\.[\w-]+)?(?=$|[\s'";|&)])/, 'acesso a arquivo .env (segredo)'],
  [/\.(pem|key|p12|pfx)\b|\bid_(rsa|ed25519)\b/, 'acesso a chave/segredo'],
];

for (const [re, label] of rules) {
  if (re.test(cmd)) {
    process.stderr.write(
      `Bloqueado pelo hook (${label}). Comando: ${cmd}\n` +
        'Se for realmente necessário, peça ao humano para executar manualmente.\n',
    );
    process.exit(2);
  }
}
process.exit(0);
