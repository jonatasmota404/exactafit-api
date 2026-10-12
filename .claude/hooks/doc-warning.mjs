#!/usr/bin/env node
// Aviso de documentação (chamado pelo hook Stop). Só imprime avisos; nunca falha nem bloqueia.
// (a) código de módulo mudou sem doc nem "Sem impacto em doc: <motivo>";
// (b) link relativo quebrado em docs/ e número de ADR duplicado.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const git = (args) => spawnSync('git', args, { encoding: 'utf8' }).stdout?.trim() ?? '';
const lines = (s) => s.split('\n').filter(Boolean);

const CODE = /^(src\/.+\.(controller|service)\.ts|src\/.+\/dto\/.+\.ts|prisma\/schema\.prisma|prisma\/migrations\/.+)$/;
// Registros de processo não contam como documentação do produto.
const NOT_PRODUCT_DOC = /^docs\/(STATUS\.md|RETRO\.md|plans\/)/;
const DECLARATION = /Sem impacto em doc:\s*(?!<)\S/i;

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const warnings = [];

const codeWithoutDocs = () => {
  const base = git(['merge-base', 'HEAD', 'main']) || 'HEAD';
  const changed = [
    ...lines(git(['diff', '--name-only', '--diff-filter=ACMR', base])),
    ...lines(git(['ls-files', '--others', '--exclude-standard'])),
  ];
  const code = changed.filter((f) => CODE.test(f));
  if (code.length === 0) return;
  if (changed.some((f) => f.startsWith('docs/') && !NOT_PRODUCT_DOC.test(f))) return;

  const declared = [
    git(['log', `${base}..HEAD`, '--format=%B']),
    ...changed.filter((f) => f.startsWith('docs/plans/') && existsSync(f)).map((f) => readFileSync(f, 'utf8')),
  ].some((t) => DECLARATION.test(t));
  if (declared) return;

  warnings.push(
    `código alterado sem doc (${code.join(', ')}). Atualize docs/architecture.md, docs/domain.md ou um ADR no mesmo commit, ` +
      'ou declare "Sem impacto em doc: <motivo>" no plano ou no commit.',
  );
};

const brokenLinks = () => {
  if (!existsSync('docs')) return;
  for (const file of walk('docs').filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1].split('#')[0];
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      if (!existsSync(normalize(join(dirname(file), target)))) warnings.push(`link quebrado em ${file}: ${m[1]}`);
    }
  }
};

const duplicatedAdrs = () => {
  if (!existsSync('docs/adr')) return;
  const byNumber = {};
  for (const f of readdirSync('docs/adr')) {
    const n = f.match(/^(\d{4})-.+\.md$/)?.[1];
    if (n) (byNumber[n] ??= []).push(f);
  }
  for (const [n, files] of Object.entries(byNumber)) {
    if (files.length > 1) warnings.push(`número de ADR duplicado ${n}: ${files.join(', ')}`);
  }
};

for (const check of [codeWithoutDocs, brokenLinks, duplicatedAdrs]) {
  try {
    check();
  } catch {
    // aviso nunca derruba o encerramento
  }
}

if (warnings.length) {
  console.log(warnings.map((w) => `⚠ Aviso de documentação: ${w}`).join('\n'));
}
process.exit(0);
