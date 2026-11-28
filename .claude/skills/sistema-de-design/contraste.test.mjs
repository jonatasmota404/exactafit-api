import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contraste } from './contraste.mjs';

test('preto sobre branco é 21:1, nos dois sentidos', () => {
  assert.equal(contraste('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(contraste('#FFFFFF', '#000000').toFixed(2), '21.00');
});

test('cinza #767676 sobre branco passa 4,5:1 e #777777 não', () => {
  assert.ok(contraste('#767676', '#FFFFFF') >= 4.5);
  assert.ok(contraste('#777777', '#FFFFFF') < 4.5);
});

test('aceita forma curta e rejeita cor inválida', () => {
  assert.equal(contraste('#fff', '#000').toFixed(2), '21.00');
  assert.throws(() => contraste('azul', '#fff'), /cor inválida/);
});
