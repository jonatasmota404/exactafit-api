#!/usr/bin/env node
// PreToolUse(Write|Edit) do agente curador-do-manual: impede escrita dentro do diretório do projeto.
// O curador só escreve no manual, que fica fora do repositório.
// Exit 2 = bloqueia a chamada; a mensagem em stderr volta para o modelo.
import { lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const block = (msg) => {
  process.stderr.write(`Bloqueado pelo hook guard-manual-write. ${msg}\n`);
  process.exit(2);
};

// Resolve `..` e links simbólicos mesmo quando o arquivo (ou parte do caminho) ainda não existe.
const resolveReal = (p, depth = 0) => {
  if (depth > 40) throw new Error('links simbólicos demais');
  try {
    return realpathSync(p);
  } catch {
    // não existe (ou link quebrado): resolve o pai e reanexa o nome
  }
  const parent = dirname(p);
  if (parent === p) return p;
  const base = basename(p);
  let target;
  try {
    target = lstatSync(p).isSymbolicLink() ? resolve(parent, readlinkSync(p)) : null;
  } catch {
    target = null;
  }
  return target ? resolveReal(target, depth + 1) : resolve(resolveReal(parent, depth + 1), base);
};

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  block('Entrada ilegível; por segurança a escrita foi negada.');
}

const filePath = input?.tool_input?.file_path;
if (typeof filePath !== 'string' || filePath === '') process.exit(0); // nada a escrever

const cwd = input?.cwd || process.cwd();
const project = process.env.CLAUDE_PROJECT_DIR || cwd;

try {
  const target = resolveReal(resolve(cwd, filePath));
  const rel = relative(resolveReal(resolve(project)), target);
  // Fora só se for exatamente '..', começar com '..' + separador ou for absoluto (outra raiz).
  // '..dados/x' é um nome de pasta dentro do projeto.
  const outside = rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel);
  const inside = !outside;
  if (inside) {
    block(`${filePath} está dentro do projeto. O curador escreve só no manual, fora do repositório.`);
  }
} catch {
  block('Caminho não resolvido; por segurança a escrita foi negada.');
}
process.exit(0);
