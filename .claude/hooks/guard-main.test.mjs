// Testes do hook guard-main. Rodar: node --test '.claude/hooks/*.test.mjs'
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('./guard-main.mjs', import.meta.url));
const repos = {};

const makeRepo = (branch) => {
  const dir = mkdtempSync(join(tmpdir(), 'guard-main-'));
  const git = (...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  if (branch !== 'main') git('switch', '-q', '-c', branch);
  return dir;
};

before(() => {
  repos.main = makeRepo('main');
  repos.work = makeRepo('feat/x');
});

const run = (command, where) =>
  spawnSync('node', [hook], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: repos[where] }),
    encoding: 'utf8',
  });

// [comando, branch ativa]
const blocked = [
  ['git push origin main', 'work'],
  ['git push origin HEAD:main', 'work'],
  ['git push origin HEAD:refs/heads/main', 'work'],
  ['git push origin feat/x:main', 'work'],
  ['git push origin +feat/x:refs/heads/main', 'work'],
  ['git push --force origin main', 'work'],
  ['git push -u origin main', 'work'],
  ['git push origin :main', 'work'],
  ['git push --all', 'work'],
  ['git push', 'main'],
  ['git push origin', 'main'],
  ['git push origin HEAD', 'main'],
  ['git merge feat/x', 'main'],
  ['git merge --no-ff feat/x', 'main'],
  ['git switch main && git merge feat/x', 'work'],
  ['git checkout main; git merge feat/x', 'work'],
  ['gh pr merge 12 --merge', 'work'],
  ['gh pr merge', 'main'],
  ['npm test && gh pr merge 3', 'work'],
  ['git pull', 'work'],
  ['git pull origin main', 'work'],
  ['git pull .', 'work'],
  ['git pull --ff-only .', 'work'],
  ['git fetch && git pull', 'work'],
  ['npm run lint:check | cat && git push origin main', 'work'],
  ['git status; git push origin HEAD:main', 'work'],
];

const allowed = [
  ['git push origin feat/x', 'work'],
  ['git push -u origin feat/x', 'work'],
  ['git push', 'work'],
  ['git push origin HEAD', 'work'],
  ['git push origin feat/x:feat/x', 'work'],
  ['git switch main', 'work'],
  ['git switch main', 'main'],
  ['git checkout main', 'work'],
  ['git pull --ff-only', 'work'],
  ['git pull --ff-only', 'main'],
  ['git pull --ff-only origin main', 'main'],
  ['git merge origin/main', 'work'],
  ['git merge --abort', 'main'],
  ['git switch main && git switch feat/x && git merge origin/main', 'work'],
  ['git merge origin/main && npm test', 'work'],
  ['gh pr create --body-file /tmp/pr.md', 'work'],
  ['gh pr view 12', 'work'],
  ['git status && git log --oneline', 'main'],
];

for (const [cmd, where] of blocked) {
  test(`bloqueia (${where}): ${cmd}`, () => {
    const r = run(cmd, where);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Merge e push na main são do humano; faça pelo PR/);
  });
}
for (const [cmd, where] of allowed) {
  test(`libera (${where}): ${cmd}`, () => assert.equal(run(cmd, where).status, 0));
}
