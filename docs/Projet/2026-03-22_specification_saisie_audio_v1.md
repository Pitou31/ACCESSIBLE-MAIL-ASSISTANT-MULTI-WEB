# Specification fonctionnelle - saisie audio

Date : 2026-03-22

## 1. Objet

Ce document décrit la première évolution prioritaire à implémenter avant les compléments d'information et avant l'automatisation navigateur avancée :
- la saisie audio.

## 2. Pourquoi cette priorité

Le projet vise à réduire la fatigue motrice.

Dans l'état actuel :
- la lecture audio existe déjà dans plusieurs zones de la page mails ;
- la saisie audio n'existe pas encore.

Or la saisie audio est une amélioration plus simple à mettre en place rapidement et immédiatement utile pour :
- dicter un prompt ;
- dicter une correction ;
- dicter une réponse ;
- limiter l'usage du clavier.

## 3. Périmètre de la première version

La première version doit rester locale, simple et focalisée sur le texte.

Pages concernées :
- `frontend/mail.html`
- `frontend/settings.html`

Scripts concernés :
- `frontend/js/mail.js`
- nouveau module de saisie audio côté frontend
- éventuellement adaptation légère de `frontend/js/settings.js`

## 4. Principe général

La saisie audio doit permettre à l'utilisateur de :
- commencer une dictée ;
- mettre en pause ;
- reprendre ;
- arrêter ;
- injecter le texte transcrit dans une zone éditable ;
- choisir si l'insertion remplace, ajoute ou complète le texte existant.

Point essentiel :
- la saisie audio de cette première version relève d'une modification traditionnelle ;
- elle ne doit pas être confondue avec une modification par IA.

Autrement dit :
- l'utilisateur dicte ;
- le système transcrit ;
- la transcription est insérée localement dans le texte ;
- aucune réécriture intelligente n'est demandée à l'IA à ce stade.

## 5. Zones de texte prioritaires

### Priorité 1

- `creationPrompt`
- `creationOutputMailContent`
- `replyOutputMailContent`

### Priorité 2

Plus tard :
- `mailSubject`
- `mailTo`
- `mailCc`
- `mailBcc`

## 6. Cas d'usage prioritaires

### Cas 1 - Dicter un prompt de création

L'utilisateur clique sur le micro à côté de `creationPrompt`.

Le système :
- démarre la reconnaissance vocale ;
- affiche un état d'écoute ;
- injecte la transcription dans `creationPrompt`.

### Cas 2 - Corriger un brouillon généré de manière traditionnelle

L'utilisateur positionne le curseur ou sélectionne un passage dans `creationOutputMailContent` ou `replyOutputMailContent`, puis dicte son texte.

Le système :
- insère le texte à la position du curseur ;
- ou remplace la sélection ;
- ou ajoute à la fin selon le mode retenu.

Exemples corrects pour cette première version :
- ajouter quelques mots à la position du curseur ;
- remplacer un passage sélectionné par un texte dicté ;
- compléter une phrase sans utiliser le clavier.

Exemples exclus à ce stade :
- "réécris cela de manière plus polie"
- "raccourcis ce paragraphe"
- "reformule avec un ton professionnel"

Ces cas relèvent d'une modification par IA, distincte de la saisie audio.

### Cas 3 - Produire une réponse en dictée directe

L'utilisateur préfère dicter une réponse complète plutôt que taper.

Le système :
- transcrit dans la zone de réponse ;
- laisse possible la relecture audio ensuite.

## 7. Modes d'insertion recommandés

La première version doit supporter au minimum :

### Mode A - Remplacer la sélection

Si un texte est sélectionné :
- la dictée remplace la sélection.

### Mode B - Insérer au curseur

Si rien n'est sélectionné :
- la dictée s'insère à la position courante du curseur.

### Mode C - Ajouter à la fin

Option simple pour un usage très guidé.

## 8. UI minimale recommandée

Pour chaque zone prioritaire, ajouter un bloc de contrôle vocal simple :
- bouton `Micro ON/OFF`
- bouton `Dicter`
- bouton `Pause`
- bouton `Reprendre`
- bouton `Stop`
- indicateur d'état :
  - en attente
  - écoute
  - pause
  - transcription insérée

## 9. Réglages à prévoir dans Paramètres

La page `Paramètres` doit prévoir un premier réglage simple :
- activer ou désactiver la saisie audio.

Réglages futurs possibles :
- langue ;
- insertion automatique ou non ;
- confirmation avant insertion ;
- ponctuation assistée ;
- mode de remplacement.

## 10. Technologie recommandée pour la première version

Première implémentation recommandée :
- Web Speech API côté navigateur.

But :
- démarrer vite ;
- rester local côté interface ;
- éviter une dépendance lourde immédiate.

## 11. Garde-fous

La saisie audio ne doit pas :
- déclencher automatiquement une génération ;
- déclencher automatiquement un envoi ;
- déclencher automatiquement une réécriture IA ;
- écraser silencieusement un texte sans règle claire ;
- modifier une zone protégée en lecture seule.

## 12. Retour utilisateur obligatoire

Le système doit toujours afficher :
- si le micro est actif ;
- si l'écoute est en cours ;
- si la dictée est arrêtée ;
- si une erreur de reconnaissance est survenue ;
- où le texte a été inséré.

## 13. Critères d'acceptation

La première version de la saisie audio est validée si :
- l'utilisateur peut dicter dans `creationPrompt` ;
- l'utilisateur peut dicter dans `creationOutputMailContent` ;
- l'utilisateur peut dicter dans `replyOutputMailContent` ;
- l'insertion se fait proprement ;
- l'état du micro est visible ;
- aucun envoi ou traitement sensible n'est déclenché automatiquement.

## 14. Étape suivante après cette implémentation

Une fois la saisie audio en place, la priorité suivante devient :
- le contrôle de complétude du contexte avant réponse IA ;
- puis la page `Règles` comme source de contexte textuel ;
- puis seulement l'ouverture progressive vers des sources externes.

La modification par IA reste un chantier distinct à traiter plus tard.
