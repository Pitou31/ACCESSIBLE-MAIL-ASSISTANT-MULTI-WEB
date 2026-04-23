## Module de traduction SSE réutilisable

### Objectif

Unifier toute la traduction derrière une seule logique technique, afin de :

- supprimer les écarts entre texte direct et pièces jointes ;
- permettre un affichage progressif cohérent ;
- rendre le traitement réutilisable dans d'autres applications ;
- éviter que le frontend reconstruise lui-même des règles métier de traduction.

### Principe retenu

Le backend devient la source unique de vérité pour la traduction.

Le frontend :

- collecte le texte source ou les pièces jointes ;
- envoie une demande de traduction ;
- ouvre un flux SSE ;
- affiche les blocs traduits au fur et à mesure.

Le backend :

- résout le texte à traduire ;
- extrait le texte utile des pièces jointes ;
- découpe le contenu en blocs ;
- traduit chaque bloc ;
- émet les événements SSE `open`, `progress`, `chunk`, `done`, `error`.

### Module réutilisable

La logique de traduction métier est centralisée dans :

- [`backend/src/services/translationService.js`](/Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI/backend/src/services/translationService.js)

Ce service regroupe :

- la construction du prompt ;
- la résolution du texte source ;
- l'extraction texte des pièces jointes via le service d'attachement ;
- le découpage en blocs ;
- le post-traitement des réponses LLM ;
- le traitement complet d'une traduction unitaire.

Le service :

- [`backend/src/services/textAssistService.js`](/Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI/backend/src/services/textAssistService.js)

reste uniquement une façade générique de compatibilité.

### Contrat de réutilisation

Une autre application peut réutiliser ce module si elle fournit :

- `action`
- `sourceLabel`
- `sourceText` et/ou `attachments`
- `targetLanguage`
- `options.model`

La réutilisation recommandée est :

1. appeler `createTranslationStreamPlan(payload)` pour préparer la traduction progressive ;
2. appeler `processTranslation(payload, options)` pour traiter un bloc ;
3. exposer les événements SSE côté application hôte.

### Règle d'architecture

Pour la traduction :

- pas de découpage métier dans le frontend ;
- pas de logique spécifique PDF/TXT/DOCX dans le frontend ;
- pas de second pipeline “simple” concurrent pour la traduction ;
- toute évolution de traduction doit passer par le module `translationService`.

### Bénéfices

- comportement homogène sur tous les blocs UI ;
- débogage plus simple ;
- meilleure portabilité vers la future application serveur ;
- base plus saine pour ajouter ensuite `résumé` et `reformulation`.
