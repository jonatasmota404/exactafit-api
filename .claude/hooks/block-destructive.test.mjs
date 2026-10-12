// Testes do hook PreToolUse de bloqueio. Rodar: node --test '.claude/hooks/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('./block-destructive.mjs', import.meta.url));
const run = (command) =>
  spawnSync('node', [hook], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  }).status;

const blocked = [
  'rm -rf dist',
  'rm -Rf ./x',
  'rm -r -f dist',
  'rm --force --recursive x',
  'git push --force origin main',
  'git push -f',
  'git push origin +main',
  'git push --force-with-lease',
  'git reset --hard HEAD~1',
  'git clean -fd',
  'npx prisma migrate reset',
  'npx prisma db push --accept-data-loss',
  "psql -c 'DROP TABLE users'",
  'docker compose down -v',
  'cat .env',
  'grep JWT .env',
  'cat ./.env.local',
  'source .env',
  'cat key.pem',
];

const allowed = [
  'rm dist/main.js',
  'rm -r dist',
  'git push -u origin chore/ai-pipeline',
  'git status',
  'grep -rn process.env src',
  'cat .env.example',
  'npm run lint:check',
  'npx prisma migrate dev --name x',
  'docker compose up -d',
  "import 'dotenv/config'",
  "git commit -m 'fix: force refresh'",
  'gh pr create --body-file /tmp/pr-body.md',
];

for (const cmd of blocked) {
  test(`bloqueia: ${cmd}`, () => assert.equal(run(cmd), 2));
}
for (const cmd of allowed) {
  test(`libera: ${cmd}`, () => assert.equal(run(cmd), 0));
}

// Comportamento conhecido: o hook casa texto, não entende shell. Um padrão perigoso
// que aparece só como texto (corpo de PR, mensagem de commit) também é bloqueado.
// Contorno: escrever o texto em arquivo e passar com --body-file / git commit -F <arquivo>.
test('falso positivo conhecido: padrão perigoso só como texto é bloqueado', () => {
  assert.equal(run('gh pr create --title x --body "deny: `rm -rf`, push forçado"'), 2);
  assert.equal(run("git commit -m 'docs: proibir git reset --hard'"), 2);
});
