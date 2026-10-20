window.KefinTweaksTranslateConfig = {
  language: 'auto',
  baseUrl: 'https://cdn.jsdelivr.net/gh/kalibrado/KefinTweaks-Translate@v0.1.0/'
};
const s = document.createElement('script');
s.src = window.KefinTweaksTranslateConfig.baseUrl + 'kefintweaks-translate.js';
s.async = true;
document.head.appendChild(s);
