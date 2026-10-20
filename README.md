# KefinTweaks-Translate

Traductions multilingues pour [KefinTweaks](https://github.com/ranaldsgift/KefinTweaks), sans fork ni modification des scripts officiels. **Projet communautaire non officiel.**

> **Statut** : prototype v0.1.0, basé sur les chaînes de KefinTweaks **v0.5.2**. Première locale : **français**. Tests sur une instance Jellyfin réelle encore nécessaires.

## Fonctionnalités

- Détection automatique de la langue de l'interface (attribut `lang` de Jellyfin Web, sinon navigateur).
- Langue forcée (`fr`, `en`, `fr-CA`, `auto`) et changement à chaud.
- Dictionnaires indépendants : `translate/en.json` (référence) et `translate/fr.json`.
- Repli en anglais pour les chaînes ou les langues inconnues.
- Traduction des textes, boutons, infobulles (`title`, `aria-label`) et placeholders, y compris dans les fenêtres créées après le chargement.
- Textes dynamiques simples (compteurs et modèles comme `Order: {n}`).
- Préserve les noms des films/séries, les valeurs des formulaires, les IDs, les URL et les requêtes Jellyfin.
- Chargement depuis une version GitHub/jsDelivr **épinglée**, pour garder script et JSON synchronisés.

## Structure

```text
KefinTweaks-Translate/
├── kefintweaks-translate.js
├── translate/
│   ├── en.json
│   └── fr.json
├── tests/
├── .github/workflows/ci.yml
├── package.json
├── LICENSE
└── README.md
```

## Installation via GitHub / jsDelivr

Installez KefinTweaks via JS Injector comme d'habitude. Créez une **entrée JavaScript Injector séparée** appelée `KefinTweaks-Translate`, sans modifier les entrées officielles KefinTweaks :

```javascript
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
```

**Important** : l'installation pointe vers un commit GitHub précis tant que le tag `v0.1.0` n'est pas publié. Le code et les dictionnaires sont ainsi lus depuis la même révision. Évitez `@main` et `@latest` pour une installation stable.

L'accès HTTP(S) aux fichiers JSON doit être autorisé par le client Jellyfin (notamment sur desktop/mobile). Si le chargement échoue, le script laisse les textes anglais.

Pour vérifier l'injection, recherchez `KefinTweaks-Translate` dans la console du navigateur. Le chargeur affiche le démarrage et une erreur explicite en cas d'échec. Pour isoler un problème de détection automatique, définissez temporairement `language: 'fr'`.

### Utilisation en console

```javascript
await window.KefinTweaksTranslate.ready;
window.KefinTweaksTranslate.stats();
await window.KefinTweaksTranslate.setLanguage('fr');
await window.KefinTweaksTranslate.setLanguage('en');
await window.KefinTweaksTranslate.setLanguage('auto');
window.KefinTweaksTranslate.refresh();
```

### Hébergement local

Héberger le dossier du dépôt derrière une URL HTTP(S) accessible depuis les appareils Jellyfin, puis remplacer `baseUrl` par la racine correspondante (terminée par `/`). Les fichiers `kefintweaks-translate.js`, `translate/en.json` et `translate/fr.json` doivent être accessibles.

## Ajouter une langue

1. Copier `translate/fr.json` vers `translate/xx.json`.
2. Adapter `meta.locale`, `messages`, `counters` et `templates` en gardant **exactement les mêmes clés**.
3. Ajouter la locale au registre `SUPPORTED` et à `LOCALE_FILES` dans `kefintweaks-translate.js` (phase v0.1.0 : ajout manuel ; automatisation prévue ensuite).
4. Exécuter `npm test` et ouvrir une pull request.

Les clés sont stables et regroupées par fonctionnalité. Dans les dictionnaires, ne modifiez pas les variables entre accolades dans les modèles et les placeholders tels que `[Genre]` ou `[Movie]`.

## Tests

```bash
npm run check
```

Des tests Node intégrés (sans dépendances npm) vérifient la structure des JSON, les chaînes, les modèles et la conversion de langue. Un banc d'essai expérimental Chromium est fourni dans `tests/run-browser.cjs` mais n'est pas inclus à la CI tant qu'il n'a pas été validé de manière reproductible.

## Limites actuelles

- Le moteur traduit uniquement les zones d'interface KefinTweaks identifiées, pas l'intégralité de Jellyfin. Certains messages encore absents du dictionnaire peuvent rester en anglais.
- Les contenus CSS `::before` / `::after` et les messages générés hors du DOM ne sont pas encore traduits.
- Les préférences de langue propres à chaque compte Jellyfin ne sont pas interrogées via une API non documentée ; le moteur préfère la langue HTML exposée par l'interface, puis celle du navigateur.
- Les applis qui n'utilisent pas Jellyfin Web ne peuvent pas bénéficier de cette extension.
- Les langues `es`, `de`, etc. ne sont **pas encore disponibles**.

## Licence

MIT. KefinTweaks est un projet distinct de ses propres auteurs.