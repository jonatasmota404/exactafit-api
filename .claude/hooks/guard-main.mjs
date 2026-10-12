#!/usr/bin/env node
// PreToolUse(Bash): impede merge e push na main e escrita no GitHub pela API. Decide sozinho, sem depender de permissões.
// Exit 2 = bloqueia a chamada; a mensagem em stderr volta para o modelo.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const MAIN = 'main';
const MSG_MERGE = 'Merge e push na main são do humano; faça pelo PR';
const MSG_API = 'Operação de escrita no GitHub e merge são do humano; faça pelo terminal ou pelo navegador';
const MSG_LITERAL = 'use o nome literal da branch';

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

// `gh api` só pode ler: bloqueia método diferente de GET e flags que enviam corpo (viram POST).
const ghApiWrite = (args, raw) => {
  for (let i = 0; i < args.length; i++) {
    const t = args[i];
    let method;
    if (t === '-X' || t === '--method') method = args[i + 1];
    else if (t.startsWith('--method=')) method = t.slice(9);
    else if (/^-X./.test(t)) method = t.slice(2).replace(/^=/, '');
    if (method !== undefined && method.toUpperCase() !== 'GET') return `gh api com método ${method}`;
    if (/^(-f|-F|--field|--raw-field|--input)$/.test(t) || /^(-[fF].|--(field|raw-field|input)=)/.test(t)) {
      return `gh api com flag de escrita (${t})`;
    }
  }
  if (args[0] === 'graphql' && /\bmutation\b/i.test(raw)) return 'gh api graphql com mutation';
  return null;
};

// Devolve { reason, msg } do bloqueio ou null. `state.branch` acompanha switch/checkout no comando composto.
const check = (tokens, state, raw) => {
  const gh = tokens.indexOf('gh');
  if (gh >= 0) {
    const rest = tokens.slice(gh + 1).filter((t) => !t.startsWith('-'));
    if (rest[0] === 'pr' && rest[1] === 'merge') return { reason: 'gh pr merge', msg: MSG_MERGE };
    if (rest[0] === 'api') {
      const reason = ghApiWrite(tokens.slice(tokens.indexOf('api', gh) + 1), raw);
      if (reason) return { reason, msg: MSG_API };
    }
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
    return state.branch === MAIN && !abort ? { reason: 'git merge na main', msg: MSG_MERGE } : null;
  }
  if (sub === 'pull') {
    return !args.includes('--ff-only') || positional.includes('.')
      ? { reason: 'git pull sem --ff-only ou com "."', msg: MSG_MERGE }
      : null;
  }
  if (sub === 'push') {
    if (args.some((t) => /\$|`/.test(t))) return { reason: 'git push com expansão de shell', msg: MSG_LITERAL };
    if (args.includes('--all') || args.includes('--mirror')) {
      return { reason: 'git push --all/--mirror', msg: MSG_MERGE };
    }
    const specs = positional.slice(1);
    if (specs.length === 0) return state.branch === MAIN ? { reason: 'git push da main', msg: MSG_MERGE } : null;
    return specs.some((s) => destOf(s, state.branch) === MAIN)
      ? { reason: 'git push para a main', msg: MSG_MERGE }
      : null;
  }
  return null;
};

const state = {};
for (const segment of cmd.split(/&&|\|\||[;|&\n]/)) {
  const tokens = segment.trim().split(/\s+/).map(clean).filter(Boolean);
  const hit = check(tokens, state, segment);
  if (hit) {
    process.stderr.write(`Bloqueado pelo hook guard-main (${hit.reason}). ${hit.msg}.\nComando: ${cmd}\n`);
    process.exit(2);
  }
}
process.exit(0);
