# Specification technique - saisie audio

Date : 2026-03-22

## 1. Objet

Ce document décrit l'implémentation technique recommandée de la saisie audio.

Il complète la specification fonctionnelle :
- `2026-03-22_specification_saisie_audio_v1.md`

## 2. Objectif technique

Ajouter une saisie audio simple, locale et progressive dans les zones éditables prioritaires de l'application.

La première version doit :
- fonctionner côté navigateur ;
- réutiliser l'architecture frontend existante ;
- ne pas perturber la lecture audio déjà en place ;
- rester indépendante de `Browser Use`.

Point important :
- cette brique correspond uniquement à une saisie locale traditionnelle ;
- elle ne doit pas embarquer de logique de réécriture ou de transformation par IA.

## 3. Périmètre technique

Fichiers concernés à prévoir :
- nouveau fichier `frontend/js/audioInput.js`
- mise à jour de `frontend/mail.html`
- mise à jour de `frontend/js/mail.js`
- mise à jour légère de `frontend/settings.html`
- mise à jour légère de `frontend/js/settings.js`
- éventuelle mise à jour légère de `frontend/css/styles.css`

## 4. Technologie recommandée

Première implémentation :
- Web Speech API
- objet `SpeechRecognition` ou `webkitSpeechRecognition` selon le navigateur

But :
- implémentation rapide ;
- fonctionnement local côté client ;
- pas de dépendance backend obligatoire dans la première version.

## 5. Contraintes techniques

### Compatibilité

La Web Speech API n'est pas garantie sur tous les navigateurs.

La première version devra donc :
- détecter la disponibilité de l'API ;
- afficher clairement si la saisie audio n'est pas disponible ;
- désactiver proprement les boutons de dictée si besoin.

### Sécurité et UX

La saisie audio ne doit jamais :
- déclencher un envoi ;
- déclencher une génération automatique ;
- modifier un champ `readonly`.

## 6. Zones cibles prioritaires

### Zone 1

`creationPrompt`

Usage :
- dicter la consigne de création.

### Zone 2

`creationOutputMailContent`

Usage :
- corriger ou compléter manuellement un brouillon généré par insertion locale.

### Zone 3

`replyOutputMailContent`

Usage :
- corriger ou compléter manuellement une réponse générée par insertion locale.

## 7. Architecture module recommandée

Créer un module séparé de `audioReader.js`.

Nom recommandé :
- `frontend/js/audioInput.js`

Objet exposé :

```javascript
window.MailAudioInput = {
  create(textareaId, options) {}
}
```

## 8. Classe recommandée

Classe principale :
- `AudioInputController`

Responsabilités :
- initialiser la reconnaissance vocale ;
- gérer les états ;
- écouter les boutons ;
- insérer la transcription dans la bonne zone ;
- exposer un statut clair à l'utilisateur.

Non-responsabilités :
- ne pas appeler l'IA ;
- ne pas reformuler ;
- ne pas corriger automatiquement le sens ;
- ne pas transformer une instruction en réécriture intelligente.

## 9. États à gérer

États minimums :
- `unsupported`
- `idle`
- `listening`
- `paused`
- `stopped`
- `error`

## 10. API interne recommandée

Méthodes recommandées :

```javascript
constructor(textElement, controlsElement, options = {})
bind()
render()
createRecognition()
startListening()
pauseListening()
resumeListening()
stopListening()
insertTranscript(text, mode)
replaceSelection(text)
insertAtCursor(text)
appendToEnd(text)
setStatus(state, message)
isSupported()
```

## 11. Structure HTML recommandée

Pour chaque zone éditable prioritaire, ajouter un bloc parallèle aux contrôles audio de lecture.

Exemple recommandé :

```html
<div class="audio-input-controls" data-audio-input-for="creationPrompt">
  <button class="audio-input-toggle-button" data-audio-input-start type="button">Dicter</button>
  <button class="mode-button" data-audio-input-pause type="button">Pause</button>
  <button class="mode-button" data-audio-input-resume type="button">Reprendre</button>
  <button class="mode-button" data-audio-input-stop type="button">Stop dictée</button>
  <select class="settings-select audio-input-mode" data-audio-input-mode>
    <option value="cursor">Insérer au curseur</option>
    <option value="selection">Remplacer sélection</option>
    <option value="append">Ajouter à la fin</option>
  </select>
  <span class="settings-help" data-audio-input-status>Dictée inactive.</span>
</div>
```

## 12. Intégration dans `mail.html`

### Sur `creationPrompt`

Ajouter le bloc de dictée sous ou à côté des contrôles de lecture audio existants.

### Sur `creationOutputMailContent`

Ajouter les mêmes contrôles.

### Sur `replyOutputMailContent`

Ajouter les mêmes contrôles.

## 13. Intégration dans `mail.js`

Dans `mail.js`, après chargement du DOM :

```javascript
const creationPromptAudioInput = window.MailAudioInput?.create("creationPrompt")
const creationOutputAudioInput = window.MailAudioInput?.create("creationOutputMailContent")
const replyOutputAudioInput = window.MailAudioInput?.create("replyOutputMailContent")
```

Cette intégration doit rester indépendante des fonctions de génération existantes.
Elle doit aussi rester indépendante des futures fonctions de modification par IA.

## 14. Intégration dans `settings.html`

Ajouter un premier réglage simple dans la section Accessibilité ou Assistance :
- `Activer la saisie audio`

Exemple :

```html
<label class="settings-toggle">
  <input id="audioInputToggle" type="checkbox" />
  <span>Activer la saisie audio</span>
</label>
```

## 15. Intégration dans `settings.js`

Ajouter le paramètre dans :
- `DEFAULT_SETTINGS`
- `SETTINGS_FIELD_IDS`

Nom recommandé :
- `audioInputEnabled`

Effet :
- activer ou désactiver globalement la disponibilité des contrôles de dictée.

## 16. Modes d'insertion

### Mode `cursor`

Comportement :
- insertion à la position du curseur ;
- si une sélection existe, insertion à la place du point de départ du curseur.

### Mode `selection`

Comportement :
- si un texte est sélectionné, il est remplacé ;
- sinon fallback sur insertion au curseur.

### Mode `append`

Comportement :
- la transcription est ajoutée à la fin du texte existant.

## 17. Gestion de la transcription

Version 1 recommandée :
- transcription finale uniquement, ou semi-finale simple ;
- éviter les comportements trop instables de mise à jour caractère par caractère.

But :
- garder une UX claire ;
- éviter les modifications erratiques du texte.

## 18. Gestion d'erreur

En cas d'erreur :
- ne jamais modifier silencieusement le texte ;
- afficher un message de statut clair ;
- remettre l'état sur `idle` ou `error`.

Exemples :
- micro non autorisé ;
- API indisponible ;
- écoute interrompue ;
- aucun son détecté.

## 19 bis. Frontière avec la modification par IA

Cette implémentation technique doit être conçue pour des usages du type :
- insertion de texte dicté ;
- remplacement local d'un passage ;
- ajout à la fin.

Elle ne doit pas être conçue pour des demandes du type :
- "réécris ce passage"
- "reformule ce texte"
- "rends ce message plus chaleureux"

Ces usages relèvent d'un autre module futur de modification par IA.

## 20. CSS recommandé

Ajouter un style spécifique :
- `.audio-input-controls`
- `.audio-input-status`
- `.audio-input-disabled`
- `.audio-input-listening`

Objectif :
- distinguer visuellement lecture audio et saisie audio ;
- éviter la confusion entre les deux.

## 21. Critères techniques de validation

La mise en œuvre est acceptable si :
- `audioInput.js` est chargé sans erreur ;
- les 3 zones prioritaires supportent la dictée ;
- les 3 modes d'insertion fonctionnent ;
- le paramètre global de saisie audio est pris en compte ;
- les champs `readonly` ne sont jamais modifiés ;
- les états visuels sont cohérents.

## 22. Étape suivante après implémentation

Une fois cette brique stabilisée :
- implémenter le contrôle de complétude du contexte ;
- rendre la page `Règles` opérationnelle ;
- faire évoluer ensuite l'assistant vers l'enrichissement de contexte et l'automatisation navigateur.
