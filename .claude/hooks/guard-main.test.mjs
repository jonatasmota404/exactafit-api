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

// guard-api: escrita no GitHub pela API e indireção de shell no push.
const blockedApi = [
  'gh api -X PUT repos/o/r/pulls/7/merge',
  'gh api --method PUT repos/o/r/pulls/7/merge',
  'gh api --method=PUT repos/o/r/pulls/7/merge',
  'gh api -XPUT repos/o/r/pulls/7/merge',
  'gh api -X POST repos/o/r/issues',
  'gh api -X DELETE repos/o/r/git/refs/heads/x',
  'gh api -X PATCH repos/o/r/branches/main/protection',
  'gh api -X put repos/o/r/branches/main/protection',
  'gh api repos/o/r/issues -f title=x',
  'gh api repos/o/r/issues -F body=@f.md',
  'gh api repos/o/r/issues --field title=x',
  'gh api repos/o/r/issues --raw-field title=x',
  'gh api repos/o/r/branches/main/protection --input body.json',
  'gh api repos/o/r/issues -ftitle=x',
  'gh api graphql -f query=mutation{x}',
  'gh api graphql --raw-field query="mutation { mergePullRequest }"',
  'npm test && gh api -X PUT repos/o/r/pulls/7/merge',
  'git status; gh api --method PUT repos/o/r/pulls/7/merge | cat',
  'sh -c "gh api -X PUT repos/o/r/pulls/7/merge"',
  "bash -c 'gh api --method=PUT repos/o/r'",
];
const blockedExpansion = [
  'BR=main; git push origin $BR',
  'git push origin $BR',
  'git push origin HEAD:$BR',
  'git push origin $(echo main)',
  'git push origin `echo main`',
  'git status && git push origin "${BRANCH}"',
  'sh -c "git push origin $B"',
];
const allowedApi = [
  'gh api repos/o/r/commits/abc123/check-runs',
  'gh api repos/o/r/commits/abc123/check-runs --jq ".check_runs[].name"',
  'gh api repos/o/r/branches/main/protection',
  'gh api -X GET repos/o/r/pulls/7',
  'gh api --method GET repos/o/r/pulls/7',
  'gh api --method=GET repos/o/r/pulls/7',
  'gh api repos/o/r/pulls --paginate',
  'gh pr view 12 --json state,mergedAt',
  'gh pr checks 12',
  'gh pr checks 12 --watch',
  'gh pr create --base main --head feat/x --fill',
  'gh pr list --state all --limit 30',
  'gh pr diff 12',
  'git push -u origin pipeline/guard-api',
  'git push origin feat/x',
  'git commit -m "docs: ajusta" && git push',
];

for (const cmd of blockedApi) {
  test(`bloqueia gh api (work): ${cmd}`, () => {
    const r = run(cmd, 'work');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Operação de escrita no GitHub e merge são do humano; faça pelo terminal ou pelo navegador/);
  });
}
for (const cmd of blockedExpansion) {
  test(`bloqueia expansão no push (work): ${cmd}`, () => {
    const r = run(cmd, 'work');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /use o nome literal da branch/);
  });
}
for (const cmd of allowedApi) {
  test(`libera (work): ${cmd}`, () => assert.equal(run(cmd, 'work').status, 0));
}
