const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const en = JSON.parse(fs.readFileSync(path.join(base, 'translate/en.json'), 'utf8'));
const fr = JSON.parse(fs.readFileSync(path.join(base, 'translate/fr.json'), 'utf8'));
const code = fs.readFileSync(path.join(base, 'kefintweaks-translate.js'), 'utf8').replace(
  '  const ready = setLanguage(requestedLocale);',
  '  api.__testing = { translateString, scanRoot, updateAttributes, updateText };\n  const ready = setLanguage(requestedLocale);'
);
function boot(lang = 'fr') {
  const context = {
    window: { KefinTweaksTranslateConfig: { language: lang, dictionaries: { en, fr } } },
    document: {
      currentScript: null,
      readyState: 'loading',
      documentElement: { getAttribute() { return 'fr'; } },
      body: null,
      addEventListener() {}
    },
    navigator: { language: 'fr-FR', languages: ['fr-FR'] },
    console: { warn() {}, info() {} },
    NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    location: { href: 'https://jellyfin.local/web/' },
    URL,
    setTimeout
  };
  vm.runInNewContext(code, context);
  return context.window.KefinTweaksTranslate;
}

test('French is selected and exact labels translated with whitespace intact', async () => {
  const api = boot('auto');
  await api.ready;
  assert.equal(api.language, 'fr');
  assert.equal(api.__testing.translateString('  Watchlist  '), '  Ma liste à voir  ');
  assert.equal(api.__testing.translateString('Feature Configuration'), 'Configuration des fonctionnalités');
  assert.equal(api.__testing.translateString('Dune: Part Two'), 'Dune: Part Two');
});

test('Dynamic count and templates work without translating paths', async () => {
  const api = boot();
  await api.ready;
  const t = api.__testing.translateString;
  assert.equal(t('1 Movies'), '1 film');
  assert.equal(t('12 Movies'), '12 films');
  assert.equal(t('Order: 11'), 'Ordre : 11');
  assert.equal(t('NetFin Skin Options'), 'Options du thème NetFin');
  assert.equal(t('Active from: 10-01 - 10-31'), 'Actif du : 10-01 - 10-31');
  assert.equal(t('https://example.com/Movies'), 'https://example.com/Movies');
});

test('Explicit language and unknown locale fall back to English', async () => {
  const api = boot('en');
  await api.ready;
  assert.equal(api.__testing.translateString('Save'), 'Save');
  assert.equal(await api.setLanguage('fr-CA'), 'fr');
  assert.equal(api.__testing.translateString('Save'), 'Enregistrer');
  assert.equal(await api.setLanguage('xx-XX'), 'en');
  assert.equal(api.__testing.translateString('Save'), 'Save');
});

test('Failed dictionary download keeps English and surfaces an error', async () => {
  const src = code;
  const context = {
    window: { KefinTweaksTranslateConfig: { language: 'fr', baseUrl: 'https://example.invalid/kt/' } },
    document: { currentScript: null, readyState: 'loading', documentElement: { getAttribute() { return 'fr'; } }, body: null, addEventListener() {} },
    navigator: { language: 'fr', languages: ['fr'] },
    console: { warn() {}, info() {} },
    NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    location: { href: 'https://jellyfin.local/web/' },
    URL,
    fetch: async () => { throw new Error('Blocked by client'); },
    setTimeout
  };
  vm.runInNewContext(src, context);
  const api = context.window.KefinTweaksTranslate;
  await api.ready;
  assert.equal(api.language, 'en');
  assert.match(api.error, /Blocked by client/);
});

test('DOM mutations translate text and attributes but never user fields or media cards', async () => {
  const api = boot('fr');
  await api.ready;
  const root = { isConnected: true, nodeType: 1, parentElement: null,
    matches(selector) { return selector.includes('.dialogContainer[data-modal-id]'); },
    closest(selector) { return this.matches(selector) ? this : null; }
  };
  function element({ blocked = false, textarea = false, attrs = {} } = {}) {
    return {
      nodeType: 1, parentElement: root, attributes: attrs,
      closest(selector) {
        if (selector === 'textarea') return textarea ? this : null;
        if (selector.includes('.card') && blocked) return this;
        if (selector.includes('.dialogContainer[data-modal-id]')) return root;
        return null;
      },
      hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
      getAttribute(name) { return this.attributes[name]; },
      setAttribute(name, value) { this.attributes[name] = value; }
    };
  }
  const button = element({ attrs: { title: 'Save', 'aria-label': 'Cancel' } });
  const node = { nodeType: 3, nodeValue: 'Save', parentElement: button };
  api.__testing.updateText(node);
  api.__testing.updateAttributes(button);
  assert.equal(node.nodeValue, 'Enregistrer');
  assert.equal(button.attributes.title, 'Enregistrer');
  assert.equal(button.attributes['aria-label'], 'Annuler');
  const media = { nodeType: 3, nodeValue: 'Watchlist', parentElement: element({ blocked: true }) };
  api.__testing.updateText(media);
  assert.equal(media.nodeValue, 'Watchlist');
  const note = { nodeType: 3, nodeValue: 'Watchlist', parentElement: element({ textarea: true }) };
  api.__testing.updateText(note);
  assert.equal(note.nodeValue, 'Watchlist');
  await api.setLanguage('en');
  api.__testing.updateText(node);
  api.__testing.updateAttributes(button);
  assert.equal(node.nodeValue, 'Save');
  assert.equal(button.attributes.title, 'Save');
  // Framework re-render: new English source on the same text node.
  await api.setLanguage('fr');
  node.nodeValue = 'Delete';
  api.__testing.updateText(node);
  assert.equal(node.nodeValue, 'Supprimer');
});
