const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const en = require('../translate/en.json');
const fr = require('../translate/fr.json');
const fixture = require('./feature-config-v0.5.2.json');

test('KefinTweaks v0.5.2 feature labels and 23 descriptions are translated', () => {
  assert.equal(fixture.length, 23);
  const translation = new Map(Object.entries(en.messages).map(([key, english]) => [english, fr.messages[key]]));
  const help = 'Toggle individual KefinTweaks features on or off. Existing configurations are maintained when disabling features.';
  assert.notEqual(translation.get(help), help);
  for (const feature of fixture) {
    assert.equal(en.messages['features.' + feature.key + '.description'], feature.description);
    assert.notEqual(translation.get(feature.description), feature.description, 'description: ' + feature.key);
    assert.notEqual(translation.get(feature.label), feature.label, 'label: ' + feature.key);
  }
});

test('a feature description is translated inside KefinTweaks UI, not an unrelated title', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../kefintweaks-translate.js'), 'utf8')
    .replace('  const ready = setLanguage(requestedLocale);',
      '  api.__testing = { translateString, updateText };\n  const ready = setLanguage(requestedLocale);');
  const ctx = {
    window: { KefinTweaksTranslateConfig: { language: 'fr', dictionaries: { en, fr } } },
    document: { currentScript: null, readyState: 'loading', documentElement: { getAttribute() { return 'fr'; } }, body: null, addEventListener() {} },
    navigator: { language: 'fr', languages: ['fr'] },
    console: { info() {}, warn() {} },
    NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    location: { href: 'https://jellyfin.invalid/web/' }, URL, setTimeout
  };
  vm.runInNewContext(source, ctx);
  const api = ctx.window.KefinTweaksTranslate;
  await api.ready;
  const scope = { closest(selector) { return selector.includes('.dialogContainer[data-modal-id]') ? this : null; } };
  const parent = { closest(selector) { return selector.includes('.dialogContainer[data-modal-id]') ? scope : null; } };
  const text = { nodeValue: fixture[0].description, parentElement: parent };
  api.__testing.updateText(text);
  assert.equal(text.nodeValue, fr.messages['features.watchlist.description']);
  assert.equal(api.__testing.translateString('Mon film personnel'), 'Mon film personnel');
});
