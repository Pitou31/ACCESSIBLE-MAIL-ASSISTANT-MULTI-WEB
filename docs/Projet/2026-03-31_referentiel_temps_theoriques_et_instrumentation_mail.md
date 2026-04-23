# Référentiel temps théoriques et instrumentation mail

Date : 2026-03-31
Projet : ACCESSIBLE_MAIL_ASSISTANT_MULTI

## 1. Objet
Ce document fixe :
1. un premier référentiel de temps théoriques ;
2. une méthode de calcul du temps théorique par scénario ;
3. le plan d'instrumentation minimale de `mail.html` / `mail.js` pour mesurer le temps réel et les actions réelles.

Ce référentiel est provisoire. Il devra être validé puis ajusté après campagne de tests.

---

# 2. Principes généraux

## 2.1 Deux temps à comparer
Pour chaque scénario métier, nous voulons comparer :
- le temps théorique ;
- le temps réel.

## 2.2 Définition du temps théorique
Le temps théorique n'est pas un temps observé. C'est un temps de référence calculé à partir d'unités standardisées.

Exemple :
- ouvrir un mail = x secondes ;
- lire 100 mots = y secondes ;
- saisir 100 caractères = z secondes.

## 2.3 Définition du temps réel
Le temps réel est mesuré dans l'application à partir d'événements datés.

## 2.4 Règle d'interprétation
Le temps théorique ne sert pas à "prouver" artificiellement un gain. Il sert à fournir une base stable de comparaison.

Le temps réel sert à mesurer l'expérience réellement vécue.

---

# 3. Référentiel initial des temps théoriques

## 3.1 Hypothèses de départ
Ces valeurs servent de base de travail. Elles pourront être ajustées après expérimentation.

### A. Navigation générale
- ouvrir la page mail : 2 s
- se connecter à une boîte mail déjà configurée : 5 s
- rafraîchir une boîte mail : 2 s
- repérer et ouvrir le bon mail dans une liste courte : 6 s
- repérer et ouvrir le bon mail dans une liste dense : 12 s
- basculer du mode création au mode réponse : 1 s

### B. Lecture et compréhension
- lecture visuelle d'un mail simple : 180 mots/minute
- lecture visuelle d'un mail complexe : 120 mots/minute
- lecture d'un texte avec assistance audio : 150 mots/minute par défaut
- repérage d'une date ou d'une action explicite : 4 s
- repérage d'une pièce jointe mentionnée : 3 s
- compréhension d'une consigne ambiguë : +10 s de surcharge théorique

### C. Saisie et édition
- saisie clavier standard : 180 caractères/minute
- saisie clavier lente/accessibilité : 90 caractères/minute
- correction simple d'un mot : 2 s
- correction d'une phrase : 6 s
- ouverture du popup dictionnaire : 1 s
- remplacement d'un mot via dictionnaire : 3 s
- insertion d'un mot via dictionnaire : 3 s
- suppression d'un mot : 2 s
- réorganisation simple d'une phrase : 5 s

### D. IA et assistance
- lancer une génération de brouillon : 1 s d'action utilisateur
- lecture du brouillon généré : 120 mots/minute
- lancer une régénération : 1 s
- lire un résumé court : 10 s
- écouter un bloc court : 8 s
- lancer une dictée : 1 s
- arrêter une dictée : 1 s

### E. Pièces jointes
- rattacher une pièce jointe locale simple : 6 s
- rattacher plusieurs pièces jointes : 10 s
- vérifier qu'une pièce jointe est bien présente : 3 s
- vérifier qu'une pièce jointe a été prise en compte : 5 s

### F. Validation et envoi
- relire une réponse courte : 15 s
- relire une réponse moyenne : 30 s
- contrôle final avant envoi : 8 s
- envoyer un mail : 2 s
- mettre un mail en attente : 2 s

---

# 4. Calcul du temps théorique par scénario

## 4.1 Principe
Le temps théorique d'un scénario est la somme des temps théoriques des étapes réellement nécessaires.

## 4.2 Exemple 1 : réponse simple sans pièce jointe
- ouvrir la boîte : 5 s
- repérer et ouvrir le mail : 6 s
- lire et comprendre un mail court de 120 mots : 40 s
- lancer la génération : 1 s
- lire un brouillon de 80 mots : 40 s
- corriger une phrase : 6 s
- contrôle final : 8 s
- envoyer : 2 s

Total théorique indicatif : 108 s

## 4.3 Exemple 2 : réponse avec pièce jointe et ambiguïté
- ouvrir la boîte : 5 s
- repérer et ouvrir le mail : 12 s
- lire le mail : 60 s
- repérer l'ambiguïté : 10 s
- vérifier la pièce jointe : 5 s
- lancer la génération : 1 s
- lire le brouillon : 50 s
- corriger deux phrases : 12 s
- rattacher une pièce jointe : 6 s
- contrôle final : 8 s
- envoyer : 2 s

Total théorique indicatif : 171 s

---

# 5. Niveaux de mesure à conserver

## 5.1 Indispensable
À enregistrer toujours au début pour les tests.

### Actions
- ouverture d'un mail
- changement de mode création/réponse
- génération de brouillon
- régénération
- lecture audio démarrée
- lecture audio arrêtée
- dictée démarrée
- dictée arrêtée
- ouverture popup dictionnaire
- validation popup dictionnaire
- ajout pièce jointe
- envoi
- mise en attente

### Temps
- temps total par session de traitement
- temps entre ouverture du mail et première génération
- temps entre génération et validation finale
- temps de lecture audio
- temps d'édition manuelle

## 5.2 Facultatif
- nombre de scrolls
- changements de voix
- changements de langue
- nombre de validations intermédiaires
- nombre d'ouvertures de popup/outils

## 5.3 Avancé
- repositionnements curseur
- sélections texte
- opérations fines dans l'éditeur popup
- micro-pauses et reprises détaillées

---

# 6. Plan d'instrumentation de `mail.js`

## 6.1 Objectif
Créer un journal d'événements minimal pour commencer à produire des statistiques réelles.

## 6.2 Fonction centrale à créer
Créer une fonction centrale du type :
- `trackMailEvent(eventType, payload)`

Exemple :
```js
trackMailEvent("draft_generate_clicked", {
  workflow: "reply",
  messageId: currentOpenedMessage?.id || ""
})
```

## 6.3 Données minimales à stocker
Chaque événement devra contenir au minimum :
- `timestamp`
- `screen = "mail"`
- `workflow = "creation" | "reply"`
- `eventType`
- `messageId` si disponible
- `accountId` ou `userId` si disponible
- `metadata`

## 6.4 Lieux d'instrumentation prioritaires
### A. Ouverture et navigation
- ouverture d'un mail reçu
- changement création/réponse
- rafraîchissement de la boîte mail
- connexion à une boîte

### B. Génération
- clic sur `Generer le brouillon`
- succès génération
- échec génération
- clic sur `Regenerer`

### C. Audio
- démarrage lecture
- arrêt lecture
- démarrage dictée
- arrêt dictée

### D. Dictionnaire
- ouverture popup dictionnaire
- validation popup dictionnaire

### E. Pièces jointes
- ajout pièce jointe
- suppression pièce jointe
- détection pièce jointe reçue

### F. Finalisation
- brouillon validé
- envoi
- mise en attente

## 6.5 Calcul du temps réel à partir des événements
Le temps réel sera calculé à partir de repères.

### Exemples
- `mail_opened` -> `draft_generate_clicked`
- `draft_generate_success` -> `send_clicked`
- `audio_read_start` -> `audio_read_stop`
- `dictionary_open` -> `dictionary_apply`

## 6.6 Stockage initial recommandé
Phase 1 :
- stockage local léger, par exemple dans `localStorage` ou dans une structure mémoire synchronisée.

Phase 2 :
- endpoint backend dédié pour historiser proprement.

---

# 7. Paramètres de statistiques à prévoir plus tard
Pour éviter de tout rendre indispensable, prévoir une future section de paramètres statistiques.

## 7.1 Réglages cibles
- activer les statistiques indispensables
- activer les statistiques détaillées
- activer les statistiques avancées
- activer la mesure des temps par étape
- activer la mesure ergonomique fine
- réinitialiser les statistiques

## 7.2 Décision de démarrage
Au début des tests :
- tout sera activé comme si tout était obligatoire
- pour vérifier que la collecte fonctionne

Ensuite :
- distinction entre indispensable, facultatif et avancé

---

# 8. Première étape recommandée
Ne pas commencer par la page `Statistiques`.

Commencer par :
1. créer la fonction `trackMailEvent` ;
2. instrumenter les événements majeurs dans `mail.js` ;
3. enregistrer les premiers temps réels ;
4. seulement ensuite construire l'affichage statistique.
