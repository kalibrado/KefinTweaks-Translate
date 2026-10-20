/**
 * KefinTweaks-Translate v0.1.1
 * Independent UI translation layer for the KefinTweaks Jellyfin web extension.
 * Upstream target: KefinTweaks v0.5.2. MIT License.
 * Does not modify KefinTweaks settings, Jellyfin API responses or user input.
 */
(function () {
  'use strict';

  const VERSION = '0.1.1';
  if (window.KefinTweaksTranslate) return;

  const settings = window.KefinTweaksTranslateConfig || {};
  const SUPPORTED = new Set(['en', 'fr']);
  const LOCALE_FILES = { en: 'translate/en.json', fr: 'translate/fr.json' };
  // Dedicated KefinTweaks UI containers. Never translate the entire Jellyfin page.
  const ROOT_SELECTORS = [
    '.dialogContainer[data-modal-id] .dialog[data-name="kefin-modal"]',
    '.sections.watchlist',
    '#smart-search-wrapper',
    '.kefin-appearance-popover',
    '.kefin-home-category-item',
    '.kefin-home-create-section-btn',
    '.kefin-noItemsMessage',
    '.kefin-toggle-card',
    '.kefin-settings-input-card',
    '.kefin-home-category-row',
    '.kefin-home-category-add-btn',
    '.watchlist-icon',
    '.watchlist-button',
    '.section-configure-gear-btn',
    '.section-unpin-btn',
    '.section-move-up-btn',
    '.section-move-down-btn',
    '[class*="hsc-"]',
    '[class*="hsae-"]',
    '[class*="hsse-"]',
    '[class*="kt-autocomplete-"]'
  ].join(',');

  const SKIP_SELECTORS = [
    'script', 'style', 'noscript', 'code', 'pre', 'textarea',
    '[contenteditable]',
    '.material-icons', '.material-symbols-outlined', '.material-symbols-rounded',
    '.card', '.cardText', '.cardText-first', '.cardText-secondary',
    '.itemName', '.itemOverview', '.overview', '.itemAction',
    '.progress-title', '.movie-title', '.top-show-name', '.progress-poster',
    '.hsae-preview-container', '.hsse-preview-container',
    '.kefin-home-category-name-input', '.hsae-select-chip-label',
    '.hsae-static-item-label', '.hsse-custom-item-label'
  ].join(',');
  const ATTRIBUTE_NAMES = ['title', 'aria-label', 'placeholder'];
  const MAX_PER_FRAME = 48;

  // Use currentScript while the loader is being evaluated: later it is null.
  const scriptUrl = document.currentScript && document.currentScript.src;
  const resolvedBase = (function () {
    try {
      const configured = settings.baseUrl || (scriptUrl ? new URL('.', scriptUrl).href : '');
      const url = new URL(configured, location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      return new URL(url.href.endsWith('/') ? url.href : url.href + '/');
    } catch (_) { return null; }
  })();

  const translations = new Map();
  const loading = new Map();
  const textOriginals = new WeakMap();
  const attributeOriginals = new WeakMap();
  const pending = new Set();
  const metrics = { text: 0, attributes: 0, frames: 0, loads: 0 };
  let observer = null;
  let queued = false;
  let running = true;
  let requestedLocale = String(settings.language || 'auto');
  let currentLocale = 'en';
  let generation = 0;
  let lastError = null;
  let lookup = new Map();
  let counters = new Map();
  let templates = [];

  function languageCode(value) {
    return String(value || '').toLowerCase().trim().split(/[-_]/)[0];
  }

  function detectLocale() {
    if (requestedLocale !== 'auto') return languageCode(requestedLocale);
    // Language configured by Jellyfin Web when present, otherwise browser locale.
    const htmlLanguage = document.documentElement && document.documentElement.getAttribute('lang');
    const browser = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return languageCode(htmlLanguage || browser);
  }

  function targetLocale() {
    const code = detectLocale();
    return SUPPORTED.has(code) ? code : 'en';
  }

  function validateDictionary(data, lang) {
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        languageCode(data.meta && data.meta.locale) !== lang ||
        !data.messages || typeof data.messages !== 'object' || Array.isArray(data.messages)) {
      throw new Error('Invalid translation dictionary for ' + lang);
    }
    return data;
  }

  async function getDictionary(locale) {
    if (translations.has(locale)) return translations.get(locale);
    if (loading.has(locale)) return loading.get(locale);
    const task = (async function () {
      const inline = settings.dictionaries && settings.dictionaries[locale];
      let data;
      if (inline) {
        data = inline;
      } else {
        if (!resolvedBase) throw new Error('Cannot resolve repository URL: set KefinTweaksTranslateConfig.baseUrl');
        const url = new URL(LOCALE_FILES[locale], resolvedBase);
        const response = await fetch(url.href, { credentials: 'omit', cache: 'default' });
        if (!response.ok) throw new Error('Translation HTTP ' + response.status + ': ' + url.href);
        data = await response.json();
      }
      const valid = validateDictionary(data, locale);
      translations.set(locale, valid);
      metrics.loads++;
      return valid;
    })();
    loading.set(locale, task);
    try { return await task; }
    finally { loading.delete(locale); }
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function parseTemplate(text) {
    const token = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
    const keys = [];
    let last = 0;
    let source = '^';
    let found;
    while ((found = token.exec(text)) !== null) {
      source += escapeRegex(text.slice(last, found.index)) + '(.+?)';
      keys.push(found[1]);
      last = token.lastIndex;
    }
    source += escapeRegex(text.slice(last)) + '$';
    return { pattern: new RegExp(source), keys };
  }

  function rebuildLookup(en, selected) {
    const exact = new Map();
    const matchingCounters = new Map();
    const dynamic = [];
    for (const [key, source] of Object.entries(en.messages || {})) {
      if (typeof source === 'string' && typeof selected.messages[key] === 'string') {
        exact.set(source, selected.messages[key]);
      }
    }
    for (const [source, values] of Object.entries(en.counters || {})) {
      const translated = selected.counters && selected.counters[source];
      if (translated && typeof translated.one === 'string' && typeof translated.other === 'string') {
        matchingCounters.set(source, translated);
      }
    }
    for (const [key, source] of Object.entries(en.templates || {})) {
      const target = selected.templates && selected.templates[key];
      if (typeof source !== 'string' || typeof target !== 'string') continue;
      const parsed = parseTemplate(source);
      if (!parsed.keys.length) continue;
      dynamic.push({ ...parsed, target });
    }
    lookup = exact;
    counters = matchingCounters;
    templates = dynamic;
  }

  function translateString(value) {
    if (!value || currentLocale === 'en') return value;
    const m = String(value).match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!m || !m[2]) return value;
    const word = m[2];
    let result = lookup.get(word);
    if (result === undefined) {
      const counter = word.match(/^(\d+)\s+(.+)$/);
      if (counter && counters.has(counter[2])) {
        const forms = counters.get(counter[2]);
        result = counter[1] + ' ' + (Number(counter[1]) === 1 ? forms.one : forms.other);
      }
    }
    if (result === undefined) {
      for (const entry of templates) {
        const found = word.match(entry.pattern);
        if (!found) continue;
        result = entry.target;
        entry.keys.forEach((key, index) => {
          result = result.replaceAll('{' + key + '}', found[index + 1]);
        });
        break;
      }
    }
    return result === undefined ? value : m[1] + result + m[3];
  }

  function isProtected(element) {
    return Boolean(element && element.closest && element.closest(SKIP_SELECTORS));
  }

  function isScoped(element) {
    return Boolean(element && element.closest && element.closest(ROOT_SELECTORS));
  }

  function updateText(node) {
    const parent = node.parentElement;
    if (!parent || !isScoped(parent) || isProtected(parent) || parent.closest('textarea')) return;
    const value = node.nodeValue;
    let state = textOriginals.get(node);
    if (!state || value !== state.output) state = { source: value, output: value };
    const next = translateString(state.source);
    state.output = next;
    textOriginals.set(node, state);
    if (value !== next) { node.nodeValue = next; metrics.text++; }
  }

  function updateAttributes(element) {
    if (!isScoped(element) || isProtected(element)) return;
    let states = attributeOriginals.get(element);
    if (!states) states = new Map();
    for (const attribute of ATTRIBUTE_NAMES) {
      if (!element.hasAttribute(attribute)) { states.delete(attribute); continue; }
      const value = element.getAttribute(attribute);
      let state = states.get(attribute);
      if (!state || value !== state.output) state = { source: value, output: value };
      const next = translateString(state.source);
      state.output = next;
      states.set(attribute, state);
      if (value !== next) { element.setAttribute(attribute, next); metrics.attributes++; }
    }
    attributeOriginals.set(element, states);
  }

  function scanRoot(root) {
    if (!root || !root.isConnected || !running) return;
    const roots = [];
    if (root.nodeType === 1 && root.matches(ROOT_SELECTORS) && !root.parentElement?.closest(ROOT_SELECTORS)) roots.push(root);
    if (root.nodeType === 1 && root.closest(ROOT_SELECTORS)) {
      const closest = root.closest(ROOT_SELECTORS);
      const top = closest.parentElement?.closest(ROOT_SELECTORS) || closest;
      if (!roots.includes(top)) roots.push(top);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll(ROOT_SELECTORS).forEach(el => {
        if (!el.parentElement?.closest(ROOT_SELECTORS) && !roots.includes(el)) roots.push(el);
      });
    }
    for (const scope of roots) {
      if (isProtected(scope)) continue;
      updateAttributes(scope);
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (node.nodeType === 1 && isProtected(node)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      while (walker.nextNode()) {
        const candidate = walker.currentNode;
        if (candidate.nodeType === 1) updateAttributes(candidate);
        else if (candidate.nodeType === 3) updateText(candidate);
      }
    }
  }

  function queueRoot(node) {
    if (!running || !node) return;
    pending.add(node);
    if (queued) return;
    queued = true;
    (window.requestAnimationFrame || (callback => setTimeout(callback, 16)))(flush);
  }

  function flush() {
    queued = false;
    if (!running) { pending.clear(); return; }
    let processed = 0;
    for (const node of pending) {
      pending.delete(node);
      scanRoot(node);
      if (++processed === MAX_PER_FRAME) break;
    }
    metrics.frames++;
    if (pending.size) {
      queued = true;
      (window.requestAnimationFrame || (callback => setTimeout(callback, 16)))(flush);
    }
  }

  function refresh() {
    if (!running || !document.body) return;
    document.querySelectorAll(ROOT_SELECTORS).forEach(el => {
      if (!el.parentElement?.closest(ROOT_SELECTORS)) queueRoot(el);
    });
  }

  function startObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') {
          if (isScoped(record.target.parentElement)) queueRoot(record.target.parentElement);
        } else if (record.type === 'attributes') {
          if (isScoped(record.target)) queueRoot(record.target);
        } else {
          for (const node of record.addedNodes) {
            if (node.nodeType === 1 && (isScoped(node) || node.querySelector?.(ROOT_SELECTORS))) queueRoot(node);
            else if (node.nodeType === 3 && isScoped(node.parentElement)) queueRoot(node.parentElement);
          }
        }
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ATTRIBUTE_NAMES });
    refresh();
  }

  async function setLanguage(lang) {
    requestedLocale = String(lang || 'auto');
    const request = ++generation;
    let locale = targetLocale();
    try {
      const [en, selected] = await Promise.all([getDictionary('en'), getDictionary(locale)]);
      if (request !== generation) return currentLocale;
      currentLocale = locale;
      rebuildLookup(en, selected);
      lastError = null;
      console.info('[KefinTweaks-Translate] Ready v' + VERSION + ' | language=' + currentLocale + ' | dictionaries=' + metrics.loads);
    } catch (error) {
      if (request !== generation) return currentLocale;
      lastError = String(error && error.message || error);
      currentLocale = 'en';
      lookup.clear(); counters.clear(); templates = [];
      console.warn('[KefinTweaks-Translate] Translation unavailable; keeping English:', lastError);
    }
    refresh();
    return currentLocale;
  }

  const api = {
    version: VERSION,
    get language() { return currentLocale; },
    get detectedLanguage() { return targetLocale(); },
    get error() { return lastError; },
    get enabled() { return running; },
    setLanguage,
    refresh,
    stop() { running = false; observer?.disconnect(); observer = null; pending.clear(); },
    resume() { running = true; startObserver(); refresh(); },
    stats() { return { ...metrics, language: currentLocale, pending: pending.size, error: lastError }; }
  };
  window.KefinTweaksTranslate = api;
  console.info('[KefinTweaks-Translate] Boot v' + VERSION + ' | requested=' + requestedLocale);

  const ready = setLanguage(requestedLocale);
  api.ready = ready;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }
})();
