#!/usr/bin/env node
// PreToolUse(Bash): impede merge e push na main. Decide sozinho, sem depender de permissões.
// Exit 2 = bloqueia a chamada; a mensagem em stderr volta para o modelo.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const MAIN = 'main';
const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const cmd = input?.tool_input?.command ?? '';
const cwd = input?.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();

const currentBranch = (dir) => {
  const r = spawnSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : MAIN; // sem resposta: assume main (falha fechada)
};

const clean = (t) => t.replace(/^['"({]+|['")};]+$/g, '');
const destOf = (spec, branch) => {
  const dest = spec.replace(/^\+/, '').split(':').pop().replace(/^refs\/heads\//, '');
  return dest === 'HEAD' ? branch : dest;
};

// Devolve o motivo do bloqueio ou null. `state.branch` acompanha switch/checkout no comando composto.
const check = (tokens, state) => {
  const gh = tokens.indexOf('gh');
  if (gh >= 0) {
    const rest = tokens.slice(gh + 1).filter((t) => !t.startsWith('-'));
    if (rest[0] === 'pr' && rest[1] === 'merge') return 'gh pr merge';
  }
  const g = tokens.indexOf('git');
  if (g < 0) return null;

  let dir = cwd;
  let i = g + 1;
  while (i < tokens.length && tokens[i].startsWith('-')) {
    if (tokens[i] === '-C' && tokens[i + 1]) dir = tokens[i + 1];
    i += tokens[i] === '-C' || tokens[i] === '-c' ? 2 : 1;
  }
  const sub = tokens[i];
  const args = tokens.slice(i + 1);
  const positional = args.filter((t) => !t.startsWith('-'));
  state.branch ??= currentBranch(dir);

  if (sub === 'switch' || (sub === 'checkout' && !args.includes('--'))) {
    if (positional.length) state.branch = positional[positional.length - 1];
    return null;
  }
  if (sub === 'merge') {
    const abort = args.includes('--abort') || args.includes('--quit');
    return state.branch === MAIN && !abort ? 'git merge na main' : null;
  }
  if (sub === 'pull') {
    return !args.includes('--ff-only') || positional.includes('.') ? 'git pull sem --ff-only ou com "."' : null;
  }
  if (sub === 'push') {
    if (args.includes('--all') || args.includes('--mirror')) return 'git push --all/--mirror';
    const specs = positional.slice(1);
    if (specs.length === 0) return state.branch === MAIN ? 'git push da main' : null;
    return specs.some((s) => destOf(s, state.branch) === MAIN) ? 'git push para a main' : null;
  }
  return null;
};

const state = {};
for (const segment of cmd.split(/&&|\|\||[;|&\n]/)) {
  const tokens = segment.trim().split(/\s+/).map(clean).filter(Boolean);
  const reason = check(tokens, state);
  if (reason) {
    process.stderr.write(
      `Bloqueado pelo hook guard-main (${reason}). Merge e push na main são do humano; faça pelo PR.\n` +
        `Comando: ${cmd}\n`,
    );
    process.exit(2);
  }
}
process.exit(0);
