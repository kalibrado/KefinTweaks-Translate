// Optional browser smoke test using locally installed Chromium (no npm dependencies).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname, '..');
const dictionaries = {
  en: JSON.parse(fs.readFileSync(path.join(base, 'translate/en.json'), 'utf8')),
  fr: JSON.parse(fs.readFileSync(path.join(base, 'translate/fr.json'), 'utf8'))
};
let html = fs.readFileSync(path.join(__dirname, 'browser-harness.html'), 'utf8');
html = html.replace('__DICTIONARIES__', JSON.stringify(dictionaries).replace(/</g, '\\u003c'));
const testFile = path.join(__dirname, '.browser-test-generated.html');
fs.writeFileSync(testFile, html);
try {
 const browser = process.env.CHROMIUM || 'chromium';
 const dom = execFileSync(browser, ['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--virtual-time-budget=6500','--dump-dom','file://'+testFile],{encoding:'utf8',timeout:35000,stdio:['ignore','pipe','ignore']});
 const result = dom.match(/<pre id="results" data-result="(PASS|FAIL|ERROR)">([\s\S]*?)<\/pre>/);
 console.log(result?.[2]?.replaceAll('&quot;','"').replaceAll('&amp;','&') || 'Browser did not emit results');
 assert.equal(result?.[1],'PASS');
} finally { fs.unlinkSync(testFile); }
