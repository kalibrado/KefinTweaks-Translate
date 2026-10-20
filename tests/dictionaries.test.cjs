const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const en = JSON.parse(fs.readFileSync(path.join(base, 'translate', 'en.json'), 'utf8'));
const fr = JSON.parse(fs.readFileSync(path.join(base, 'translate', 'fr.json'), 'utf8'));
const code = fs.readFileSync(path.join(base, 'kefintweaks-translate.js'), 'utf8');

test('English/French JSON is structurally valid with matching keys', () => {
  assert.equal(en.meta.locale, 'en');
  assert.equal(fr.meta.locale, 'fr');
  assert.ok(Object.keys(en.messages).length >= 480);
  assert.deepEqual(Object.keys(en.messages).sort(), Object.keys(fr.messages).sort());
  assert.deepEqual(Object.keys(en.counters).sort(), Object.keys(fr.counters).sort());
  assert.deepEqual(Object.keys(en.templates).sort(), Object.keys(fr.templates).sort());
  for (const [key, value] of Object.entries(fr.messages)) {
    assert.equal(typeof value, 'string', key);
    assert.ok(value.trim(), key);
  }
});

test('Dynamic template placeholders match in source and translations', () => {
  const placeholders = s => [...s.matchAll(/\{([a-zA-Z]+)\}/g)].map(x => x[1]).sort();
  for (const key of Object.keys(en.templates)) {
    assert.deepEqual(placeholders(en.templates[key]), placeholders(fr.templates[key]), key);
  }
});

test('French keeps bracket substitution tokens used by KefinTweaks', () => {
  for (const [key, source] of Object.entries(en.messages)) {
    const tokens = s => [...s.matchAll(/\[[A-Za-z]+\]/g)].map(m => m[0]).sort();
    // Some existing strings intentionally change natural language order, not substitution tokens.
    assert.deepEqual(tokens(source), tokens(fr.messages[key]), key);
  }
});

test('Loader compiles and can boot without a DOM immediately being ready', () => {
  new vm.Script(code, { filename: 'kefintweaks-translate.js' });
});
