#!/usr/bin/env node
// Aviso de teste alterado (chamado pelo hook Stop). Só imprime avisos; nunca falha nem bloqueia.
// Compara a branch com a main e avisa quando, em arquivo de teste: (a) o arquivo foi apagado sem outro
// arquivo de teste novo no lugar; (b) entrou skip, todo, only, xit ou xdescribe; (c) saíram mais
// verificações (expect/assert) do que entraram. Declarar "Teste alterado: <motivo>" no commit ou no plano
// silencia o aviso. Limite conhecido: não vê troca de valor esperado (toBe(1) virar toBe(2)).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const git = (args) => spawnSync('git', args, { encoding: 'utf8' }).stdout?.trim() ?? '';
const lines = (s) => s.split('\n').filter(Boolean);

// AJUSTAR (projeto): quais caminhos contam como teste. Ver PROJECT-ADJUST.md.
const TEST = /(^|\/)(test|tests|__tests__)\/|\.(spec|test)\.[cm]?[jt]sx?$|\.e2e-spec\.[jt]s$/;
// Teste desativado: it.skip, test.todo, describe.only, xit, xdescribe...
const DISABLED = /\b(it|test|describe)\.(skip|todo|only)\b|\b(xit|xtest|xdescribe)\b/;
// Verificação: expect(...) ou assert(...) / assert.equal(...) / assertEquals(...).
const CHECK = /\b(expect|assert\w*)\s*[.(]/g;
const DECLARATION = /Teste alterado:\s*(?!<)\S/i;

const base = git(['merge-base', 'HEAD', 'main']) || 'HEAD';
const warnings = [];

const deletedTests = () => {
  const gone = lines(git(['diff', '--name-only', '--diff-filter=D', base])).filter((f) => TEST.test(f));
  const added = lines(git(['diff', '--name-only', '--diff-filter=A', base]))
    .concat(lines(git(['ls-files', '--others', '--exclude-standard'])))
    .filter((f) => TEST.test(f));
  // Arquivo movido ou renomeado conta como substituído: há teste novo na mesma branch.
  if (gone.length && added.length === 0) {
    warnings.push(`arquivo de teste apagado (${gone.join(', ')}). Teste não se apaga para passar; se foi intencional, declare "Teste alterado: <motivo>".`);
  }
};

const changedLines = (file) => {
  const diff = git(['diff', '-U0', base, '--', file]);
  const side = (sign) => lines(diff).filter((l) => l.startsWith(sign) && !l.startsWith(sign.repeat(3)));
  return { added: side('+'), removed: side('-') };
};

const edited = () => {
  const files = lines(git(['diff', '--name-only', '--diff-filter=M', base])).filter((f) => TEST.test(f));
  for (const file of files) {
    const { added, removed } = changedLines(file);
    if (added.some((l) => DISABLED.test(l) && !removed.includes(l))) {
      warnings.push(`teste desativado em ${file} (skip, todo, only, xit ou xdescribe). Declare "Teste alterado: <motivo>" se for intencional.`);
    }
    const count = (ls) => ls.reduce((n, l) => n + (l.match(CHECK)?.length ?? 0), 0);
    const lost = count(removed) - count(added);
    if (lost > 0) {
      warnings.push(`menos verificações em ${file} (-${lost}). Teste não se enfraquece para passar; se foi intencional, declare "Teste alterado: <motivo>".`);
    }
  }
};

const declared = () => {
  const plans = lines(git(['diff', '--name-only', '--diff-filter=ACMR', base]))
    .concat(lines(git(['ls-files', '--others', '--exclude-standard'])))
    .filter((f) => f.startsWith('docs/plans/') && existsSync(f))
    .map((f) => readFileSync(f, 'utf8'));
  return [git(['log', `${base}..HEAD`, '--format=%B']), ...plans].some((t) => DECLARATION.test(t));
};

for (const check of [deletedTests, edited]) {
  try {
    check();
  } catch {
    // aviso nunca derruba o encerramento
  }
}

let isDeclared = false;
try {
  isDeclared = declared();
} catch {
  // sem declaração legível, o aviso sai
}

if (warnings.length && !isDeclared) {
  console.log(warnings.map((w) => `⚠ Aviso de testes: ${w}`).join('\n'));
}
process.exit(0);
