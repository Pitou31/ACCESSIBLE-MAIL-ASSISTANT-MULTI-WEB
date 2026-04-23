# Specification fonctionnelle V2 - Sprint 1

Date : 2026-03-21

## 1. Objet

Ce document definit le premier sprint de la V2.

Le Sprint 1 doit etre volontairement limite.
Il ne cherche pas a introduire toute l'automatisation V2.
Il cherche a produire une premiere version utile, testable et rassurante.

## 2. Perimetre du Sprint 1

Pages concernees uniquement :
- `frontend/mail.html`
- `frontend/settings.html`

Fichiers scripts directement lies :
- `frontend/js/mail.js`
- `frontend/js/settings.js`

Hors perimetre du Sprint 1 :
- page compte ;
- page d'accueil ;
- envoi automatique ;
- chainage autonome de plusieurs mails ;
- actions complexes de type archivage en serie, etiquetage avance, suppression automatique.

## 3. But fonctionnel du Sprint 1

Permettre une premiere automatisation navigateur utile pour reduire la fatigue sur les gestes suivants :
- ouvrir et rafraichir la boite ;
- ouvrir un mail cible ;
- guider le scroll vers les bonnes zones ;
- injecter un brouillon deja valide ;
- activer un mode V2 prudent depuis la page parametres.

## 4. Vision produit de ce Sprint 1

En sortie de Sprint 1, l'utilisateur doit pouvoir :
- activer un mode V2 simple ;
- ouvrir sa boite et l'inbox plus facilement ;
- ouvrir plus facilement le mail a traiter ;
- etre amene automatiquement vers les bonnes zones de lecture et de reponse ;
- reinjecter un brouillon valide avec beaucoup moins de manipulations.

## 5. Capacites V2 attendues dans le Sprint 1

## 5.1 Sur la page mails

### Fonction F1 - Session navigateur V2 de type `open_inbox`

But :
- aider l'utilisateur a atteindre rapidement la bonne inbox.

Existant utilise :
- `mailboxEmail`
- `mailboxConnectBtn`
- `mailboxRefreshBtn`
- `mailboxConnectionsList`
- `mailboxMessagesList`
- `mailboxFeedback`

Comportement attendu :
- si une connexion existe deja, l'application peut lancer une session navigateur V2 pour ouvrir la bonne connexion ;
- la session doit amener l'utilisateur jusqu'a la zone `Inbox connectée` ;
- la session doit pouvoir declencher `Rafraîchir l'Inbox` ;
- une trace doit indiquer ce que l'automatisation a essaye de faire.

Exemple concret :
- l'utilisateur arrive sur `mail.html` ;
- il lance l'aide V2 `Ouvrir la boite` ;
- Browser Use selectionne la connexion active, lance le rafraichissement et positionne l'affichage sur `mailboxMessagesList`.

### Fonction F2 - Session navigateur V2 de type `open_message`

But :
- aider l'utilisateur a ouvrir le bon mail sans effort de navigation.

Existant utilise :
- `mailboxMessagesList`
- la priorite calculee dans le flux actuel ;
- `classificationValue`
- `priorityValue`

Comportement attendu :
- l'application doit pouvoir proposer l'ouverture du mail prioritaire ;
- Browser Use doit pouvoir cliquer le bon element dans `mailboxMessagesList` ;
- l'utilisateur doit etre amene jusqu'au contenu utile du message ;
- la session doit ensuite s'arreter et rendre la main.

Exemple concret :
- dans `Inbox connectée`, le premier mail critique ou haute priorite est cible ;
- Browser Use l'ouvre ;
- l'affichage est amene vers le contenu du mail ;
- la classification et la priorite sont visibles sans recherches supplementaires.

### Fonction F3 - Session navigateur V2 de type `guide_reading`

But :
- reduire les scrolls manuels fatigants.

Existant utilise :
- `receivedMailContent`
- `receivedAttachmentsPreview`
- `replyAiTrace`
- `creationAiTrace`
- `replyOutputMailContent`
- `creationOutputMailContent`

Comportement attendu :
- l'utilisateur doit pouvoir demander a Browser Use d'aller a une zone cible ;
- les zones minimales a supporter sont :
  - contenu du mail ;
  - pieces jointes ;
  - trace IA ;
  - brouillon genere.

Exemple concret :
- Browser Use amène l'utilisateur d'abord au corps du message ;
- ensuite aux pieces jointes si elles existent ;
- puis au bloc `Trace envoyée à la génération IA` ;
- puis au contenu editable.

### Fonction F4 - Session navigateur V2 de type `inject_reply`

But :
- reinjecter un brouillon valide dans le webmail.

Existant utilise :
- `creationOutputMailContent`
- `replyOutputMailContent`
- boutons de generation deja presents

Comportement attendu :
- l'injection ne doit etre possible qu'apres validation humaine du texte ;
- Browser Use doit ouvrir la bonne zone d'edition dans le webmail ;
- Browser Use doit coller le texte dans la bonne zone ;
- Browser Use doit repositionner le curseur pour la relecture finale.

Exemple concret :
- l'utilisateur clique `Generer le brouillon` ;
- il relit le contenu ;
- il demande `Injecter le brouillon` ;
- Browser Use ouvre la zone de reponse du webmail, colle le texte et laisse le curseur dans l'editeur.

## 5.2 Sur la page parametres

### Fonction F5 - Activation d'un mode V2 prudent

But :
- permettre un pilotage simple de la V2.

Existant utilise :
- `generationModeSelect`
- `simulationToggle`
- `validationToggle`
- `draftToggle`
- `attachmentsModeSelect`

Comportement attendu :
- l'utilisateur doit pouvoir activer un profil V2 prudent ;
- ce profil doit privilegier :
  - brouillon automatique autorise ;
  - simulation d'envoi active ;
  - validation obligatoire active ;
  - ouverture assistee des pieces jointes si necessaire.

Exemple concret :
- en un seul enchainement, la page parametres bascule sur un mode :
  - `generationModeSelect = automatic`
  - `draftToggle = actif`
  - `simulationToggle = actif`
  - `validationToggle = actif`

### Fonction F6 - Reglage du confort moteur minimum

But :
- adapter la V2 aux personnes fatiguees par la navigation.

Existant utilise :
- `scrollSpeedSelect`
- `contentStepSelect`
- `progressiveReadingToggle`
- `openPreviewBtn`

Comportement attendu :
- l'utilisateur doit pouvoir activer rapidement un profil de confort moteur ;
- ce profil doit regler le scroll et la progression de lecture ;
- l'aperçu doit pouvoir etre ouvert pour verification.

Exemple concret :
- Browser Use regle un scroll lent ;
- fixe une quantite reduite de contenu par etape ;
- active la lecture progressive ;
- ouvre l'aperçu via `openPreviewBtn`.

## 6. UI minimale a ajouter pour le Sprint 1

Le Sprint 1 doit rester leger.
Il faut ajouter seulement les controles strictement necessaires.

### Sur la page mails

Ajouter un petit bloc V2 avec :
- un bouton `Ouvrir la boite`
- un bouton `Ouvrir le mail prioritaire`
- un bouton `Aller au contenu`
- un bouton `Aller aux pièces jointes`
- un bouton `Aller à la trace IA`
- un bouton `Injecter le brouillon`

### Sur la page parametres

Ajouter un petit bloc V2 avec :
- un bouton `Activer le mode V2 prudent`
- un bouton `Activer le confort moteur`
- une zone d'information indiquant les garde-fous actifs

## 7. Comportement de garde-fou obligatoire

Pour le Sprint 1, les garde-fous suivants sont obligatoires :
- aucune injection sans texte valide ;
- aucun envoi automatique ;
- aucune suppression automatique ;
- aucune action V2 sans trace visible ;
- validation humaine obligatoire avant toute action de sortie.

## 8. Traces et retour utilisateur

Le Sprint 1 doit afficher clairement :
- quelle action V2 a ete demandee ;
- quelle action navigateur a ete tentee ;
- quel a ete le resultat ;
- si la main a ete rendue a l'utilisateur.

Forme minimale recommandee :
- un petit journal V2 sur la page mails ;
- un message de statut V2 sur la page parametres.

## 9. Critères d'acceptation

Le Sprint 1 est considere comme reussi si :

1. l'utilisateur peut activer un mode V2 prudent depuis la page parametres ;
2. l'utilisateur peut ouvrir et rafraichir sa boite plus facilement ;
3. l'utilisateur peut ouvrir le mail prioritaire sans navigation manuelle lourde ;
4. l'utilisateur peut atteindre rapidement le contenu, les pieces jointes et la trace IA ;
5. l'utilisateur peut reinjecter un brouillon valide ;
6. aucun envoi automatique n'est possible ;
7. chaque action V2 laisse une trace lisible.

## 10. Ce qui viendra au Sprint 2

Le Sprint 2 pourra ensuite ajouter :
- plus de commandes de navigation ;
- une meilleure reprise de contexte ;
- le pilotage V2 depuis les parametres par connexion de boite ;
- une orchestration plus fine de l'ouverture et du traitement du mail ;
- les premieres briques de la page compte.

## 11. Recommandation finale

Le Sprint 1 ne doit pas se disperser.

Le coeur du sprint doit etre :
- `mail.html` pour l'automatisation utile ;
- `settings.html` pour l'activation et les garde-fous.

Si ce sprint est stable, alors la V2 aura une base concrete, visible et testable avant d'aller plus loin.
