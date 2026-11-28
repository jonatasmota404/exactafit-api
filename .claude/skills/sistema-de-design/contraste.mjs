#!/usr/bin/env node
// Razão de contraste WCAG 2.2 entre duas cores hexadecimais.
// Uso: node contraste.mjs <cor-da-frente> <cor-do-fundo>   ex.: node contraste.mjs '#1E3A8A' '#FFFFFF'
import { pathToFileURL } from 'node:url';

export function luminancia(hex) {
  const h = hex.replace('#', '');
  const cheio = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(cheio)) throw new Error(`cor inválida: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(cheio.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [a, b] = process.argv.slice(2);
  if (!a || !b) {
    console.error('Uso: node contraste.mjs <cor-da-frente> <cor-do-fundo>');
    process.exit(2);
  }
  const r = contraste(a, b);
  const ok = (min) => (r >= min ? 'passa' : 'NÃO passa');
  console.log(`${a} sobre ${b}: ${r.toFixed(2)}:1 | texto 4,5:1 ${ok(4.5)} | texto grande e não texto 3:1 ${ok(3)}`);
}
