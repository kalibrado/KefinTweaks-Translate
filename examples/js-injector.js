(() => {
  'use strict';
  const baseUrl = 'https://cdn.jsdelivr.net/gh/kalibrado/KefinTweaks-Translate@5a392e0a5c99992ac28bb1d1cf300d05e84c1567/';
  window.KefinTweaksTranslateConfig = {
    language: 'auto', // Utiliser 'fr' pour forcer le français
    baseUrl
  };
  console.info('[KefinTweaks-Translate/Loader] Chargement :', baseUrl);

  const script = document.createElement('script');
  script.src = baseUrl + 'kefintweaks-translate.js';
  script.async = true;
  script.onload = () => console.info('[KefinTweaks-Translate/Loader] Script téléchargé');
  script.onerror = () => console.error('[KefinTweaks-Translate/Loader] Script inaccessible :', script.src);
  (document.head || document.documentElement).appendChild(script);
})();
