## Politique générale de traduction des mails

### Objectif

La traduction ne doit pas fonctionner comme une génération libre.

Elle doit appliquer une règle unique, cohérente avec les règles déjà en place pour :

- la création de mail ;
- la réponse à un mail ;
- les formules d'appel ;
- les formules de clôture ;
- les signatures ;
- les textes issus de pièces jointes.

### Principe

Une traduction est une transformation contrôlée d'un contenu existant.

Elle doit :

- conserver le sens ;
- conserver la structure ;
- conserver les paragraphes ;
- ne rien inventer ;
- ne rien supprimer ;
- ne pas reformuler librement ;
- rester compatible avec les règles métier déjà présentes dans les workflows mail.

### Segments logiques

Avant traduction, le contenu est interprété en segments métier :

- `salutation`
- `body`
- `closing`
- `signature`
- `attachment`

Chaque segment reçoit une politique propre.

### Règles par segment

#### `salutation`

- garder une formule d'appel de même niveau de politesse ;
- ne pas inventer de destinataire absent ;
- ne pas transformer une salutation en introduction de mail complète.

#### `body`

- traduire fidèlement le contenu ;
- conserver les paragraphes ;
- ne pas réécrire le message comme un nouveau mail ;
- ne pas ajouter de titre, d'objet, de signature ou de contexte absent.

#### `closing`

- produire une formule de clôture courte et équivalente ;
- ne pas ajouter de nom, fonction ou bloc de signature ;
- rester compatible avec le ton professionnel attendu dans l'application.

#### `signature`

- ne jamais inventer un nom, une fonction ou des coordonnées ;
- si le texte source contient un placeholder, traduire uniquement ce placeholder ;
- conserver le nombre de lignes.

#### `attachment`

- traduire le texte extrait fidèlement ;
- ne pas ajouter de commentaire éditorial ;
- ne pas transformer le contenu en synthèse.

### Traductions déterministes

Pour les formules d'appel et de clôture les plus standard, la traduction doit privilégier une correspondance déterministe au lieu d'un appel LLM libre.

Exemples de familles couvertes :

- `Bonjour,`
- `Bonjour Madame,`
- `Bonjour Monsieur,`
- `Bonjour Madame, Monsieur,`
- `Madame, Monsieur,`
- `Cordialement`
- `Bien cordialement`

### Architecture

Le module de référence est :

- [`backend/src/services/textAssistService.js`](/Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI/backend/src/services/textAssistService.js)

Il doit centraliser :

- la détection du type de segment ;
- la politique de traduction associée ;
- les traductions déterministes des formules standard ;
- le prompt LLM pour les segments non déterministes ;
- la préparation du streaming SSE.

### Règle de maintenance

Toute évolution de la traduction doit d'abord être intégrée dans cette politique générale.

Il ne faut pas :

- corriger un cas isolé directement dans l'UI ;
- ajouter une rustine spécifique à un seul workflow ;
- dupliquer la logique de traduction dans une autre couche.

La règle unique doit rester réutilisable dans d'autres applications.
