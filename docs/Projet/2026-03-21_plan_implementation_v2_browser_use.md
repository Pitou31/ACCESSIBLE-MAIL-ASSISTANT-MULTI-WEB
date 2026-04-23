# Plan d'implementation V2 - Browser Use

Date : 2026-03-21

## 1. Objet

Ce document definit ce qu'il faut implementer en premier pour la V2.

Objectif de la V2 :
- apporter une automatisation utile ;
- reduire les gestes repetitifs ;
- diminuer la fatigue motrice ;
- conserver le controle humain sur les actions sensibles.

La V2 ne cherche pas a rendre l'agent navigateur autonome sur tout.
Elle cherche a lui faire prendre en charge les manipulations les plus fatigantes dans l'existant.

## 2. Principe directeur

La priorite n'est pas d'automatiser toutes les pages.
La priorite est d'automatiser les gestes qui apportent le plus de gain concret.

Ordre recommande :
1. page mails
2. page parametres
3. page compte
4. page d'accueil

## 3. Ce que la V2 doit faire exactement

La V2 doit prendre en charge en priorite :
- les clics repetitifs ;
- les scrolls fatigants ;
- le repositionnement du curseur ;
- l'ouverture des bonnes zones ;
- la reprise de contexte ;
- l'injection d'un brouillon deja valide.

La V2 ne doit pas faire par defaut :
- l'envoi automatique ;
- la suppression automatique sans confirmation ;
- des actions navigateur non tracees ;
- des parcours libres non bornes.

## 4. Page mails - priorite absolue

Fichiers existants concernes :
- `frontend/mail.html`
- `frontend/js/mail.js`

### 4.1 Pourquoi cette page en premier

C'est ici que l'utilisateur fait le plus de gestes :
- connecter la boite ;
- rafraichir ;
- ouvrir un mail ;
- scroller dans le contenu ;
- generer un brouillon ;
- revenir a la bonne zone ;
- traiter plusieurs mails.

C'est donc ici que `Browser Use` apportera le gain le plus fort.

### 4.2 Elements exacts a exploiter dans l'existant

Zone connexion et inbox :
- champ `mailboxEmail`
- bouton `mailboxConnectBtn`
- bouton `mailboxRefreshBtn`
- bouton `automaticProcessingStartBtn`
- bouton `automaticProcessingStopBtn`
- zone `mailboxConnectionsList`
- zone `mailboxMessagesList`
- message `mailboxFeedback`
- message `automaticProcessingFeedback`
- message `automaticProcessingContext`

Zone traitement :
- boutons `createModeBtn` et `replyModeBtn`
- select `llmSelect`
- badges `classificationBadge` et `priorityBadge`
- champ `creationPrompt`
- bouton `creationGenerateBtn`
- bouton `creationRegenerateBtn`
- zone `creationOutputMailContent`
- zone `creationAiTrace`
- zone `receivedMailContent`
- zone `replyOutputMailContent`
- bouton `replyGenerateBtn`
- bouton `replyRegenerateBtn`
- zone `replyAiTrace`

Actions finales :
- `creationSendBtn`, `creationRejectBtn`, `creationDeleteBtn`
- `replySendBtn`, `replyRejectBtn`, `replyDeleteBtn`

### 4.3 Automatisations V2 a implementer en premier

#### Lot V2.1 - Navigation de base dans la boite

But :
- eviter les manipulations inutiles avant meme le traitement d'un mail.

Comportements cibles :
- ouvrir automatiquement la bonne connexion dans `mailboxConnectionsList` ;
- cliquer automatiquement sur `Rafraîchir l'Inbox` ;
- scroller jusqu'a `Inbox connectée` ;
- mettre en evidence le message prioritaire.

Exemple concret :
- l'utilisateur arrive sur `mail.html` ;
- Browser Use detecte qu'une connexion existe deja ;
- il ouvre la zone `Connexions enregistrées` ;
- il clique ou selectionne la bonne connexion ;
- il declenche `mailboxRefreshBtn` ;
- il descend vers `mailboxMessagesList`.

#### Lot V2.2 - Ouverture assistee du bon mail

But :
- eviter la recherche visuelle et les clics repetes dans l'inbox.

Comportements cibles :
- reperer le mail le plus prioritaire ;
- l'ouvrir automatiquement ;
- repositionner l'affichage sur son contenu ;
- amener l'utilisateur sur la bonne zone de lecture.

Exemple concret :
- apres rafraichissement, l'agent cible le premier mail critique ou haute priorite ;
- il l'ouvre ;
- il scrolle jusqu'au corps utile ;
- il met ensuite l'accent sur la classification et la priorite affichees.

#### Lot V2.3 - Lecture assistee et deplacement dans le contenu

But :
- reduire le cout physique du scroll manuel.

Comportements cibles :
- scroll vers les blocs importants ;
- saut vers les pieces jointes ;
- retour rapide vers la zone de reponse ;
- retour rapide vers la trace IA.

Exemple concret :
- Browser Use ouvre un mail avec pieces jointes ;
- il amene l'utilisateur d'abord au corps du message ;
- puis a `receivedAttachmentsPreview` ou a l'information de pieces jointes ;
- puis a `replyAiTrace` apres generation.

#### Lot V2.4 - Injection du brouillon deja valide

But :
- supprimer les gestes les plus repetitifs apres la generation.

Comportements cibles :
- prendre le contenu de `creationOutputMailContent` ou `replyOutputMailContent` ;
- ouvrir la bonne zone d'edition dans le webmail ;
- coller le brouillon au bon endroit ;
- repositionner le curseur pour relecture humaine.

Exemple concret :
- l'utilisateur clique `Generer le brouillon` ;
- il valide le texte ;
- Browser Use ouvre la zone de reponse du webmail ;
- il reinjecte le contenu ;
- il laisse le curseur dans la zone editable pour correction finale.

### 4.4 Ce qui reste hors V2 sur cette page

A reserver plus tard :
- traitement libre d'une longue file de mails sans supervision ;
- etiquetage et archivage complexes en chaine ;
- envoi automatique standard ;
- boucle autonome multi-messages.

## 5. Page parametres - deuxieme priorite

Fichiers existants concernes :
- `frontend/settings.html`
- `frontend/js/settings.js`

### 5.1 Pourquoi cette page en deuxieme

Cette page doit devenir le centre de pilotage de la V2.
Elle porte deja les reglages qui peuvent encadrer l'automatisation.

### 5.2 Elements exacts a exploiter dans l'existant

Accessibilite :
- `scrollSpeedSelect`
- `contentStepSelect`
- `progressUnitInput`
- `progressiveReadingToggle`
- `buttonSizeSelect`
- `confirmationsToggle`

Assistance IA :
- `defaultModelSelect`
- `assistanceLevelSelect`
- `generationModeSelect`
- `comparisonToggle`

Gestion des mails :
- `attachmentsModeSelect`
- `simulationToggle`
- `validationToggle`
- `deleteConfirmationToggle`
- `draftToggle`

### 5.3 Automatisations V2 a implementer en premier

#### Lot V2.5 - Pilotage rapide d'un profil prudent

But :
- permettre une configuration simple de l'assistance sans efforts.

Comportements cibles :
- scroll automatique vers `Gestion des mails` ;
- application d'un profil V2 securise ;
- maintien automatique de `simulationToggle` et `validationToggle`.

Exemple concret :
- l'utilisateur demande un mode V2 ;
- Browser Use ouvre la page parametres ;
- il scrolle a `Gestion des mails` ;
- il active `draftToggle` ;
- il laisse `simulationToggle` et `validationToggle` actifs.

#### Lot V2.6 - Pilotage du confort moteur

But :
- adapter l'interface a la fatigue physique.

Comportements cibles :
- regler `scrollSpeedSelect` ;
- regler `contentStepSelect` ;
- activer `progressiveReadingToggle` si utile ;
- ouvrir `openPreviewBtn` pour visualiser.

Exemple concret :
- pour un utilisateur fatigue par les longs scrolls, Browser Use regle une vitesse lente, une quantite d'affichage reduite et ouvre l'aperçu.

### 5.4 Ce qui reste hors V2 sur cette page

A reserver plus tard :
- profils complets auto-appliques par boite ;
- orchestration avancée multi-profils ;
- decision automatique de politiques complexes par contexte.

## 6. Page compte - troisieme priorite

Fichiers existants concernes :
- `frontend/account.html`
- `frontend/js/account.js`

### 6.1 Pourquoi cette page en troisieme

Le gain existe, mais il est moins frequent que sur la page mails.
La page compte doit surtout reduire les gestes d'entree dans l'application.

### 6.2 Elements exacts a exploiter dans l'existant

- `loginAccountType`
- `loginEmail`
- `loginPassword`
- `forgotPasswordButton`
- `accountStatusButton`
- `loginChoiceButton`
- `logoutButton`
- `accountStatusCard`
- `sessionStatusCard`
- `changePasswordButton`

### 6.3 Automatisations V2 a implementer en premier

#### Lot V2.7 - Connexion assistee

But :
- rendre l'entree dans l'application plus legere.

Comportements cibles :
- focus automatique sur `loginEmail` ;
- passage guide au champ suivant ;
- clic assiste sur `loginChoiceButton` ;
- scroll vers `sessionStatusCard`.

Exemple concret :
- Browser Use positionne le curseur sur `loginEmail` ;
- apres saisie, il passe a `loginPassword` ;
- il clique `Se connecter` ;
- il amene ensuite l'utilisateur sur `Session active`.

#### Lot V2.8 - Verification assistee du statut

But :
- faciliter le parcours quand l'utilisateur ne sait pas si son compte est pret.

Comportements cibles :
- remplissage minimal ;
- clic sur `accountStatusButton` ;
- mise en avant de `accountStatusCard`.

Exemple concret :
- l'utilisateur saisit juste son email et son type de compte ;
- Browser Use clique `Verifier mon statut` ;
- il descend automatiquement vers le bloc `Etat du dossier`.

### 6.4 Ce qui reste hors V2 sur cette page

A reserver plus tard :
- parcours complets de gestion admin ;
- resolution semi-autonome d'anomalies de compte ;
- traitement en serie de multiples operations compte.

## 7. Page d'accueil - quatrieme priorite

Fichiers existants concernes :
- `frontend/index.html`
- `frontend/js/sidebar.js`

### 7.1 Pourquoi cette page en dernier

La page d'accueil est importante pour l'orientation, mais elle produit moins de gain direct que la page mails.

### 7.2 Elements exacts a exploiter dans l'existant

- navigation sidebar ;
- logique de session via `sidebar.js` ;
- redirection selon acces prive/public ;
- etat de session stocke en local.

### 7.3 Automatisations V2 a implementer en premier

#### Lot V2.9 - Reprise de contexte

But :
- ne pas refaire passer l'utilisateur par des clics inutiles.

Comportements cibles :
- detecter session active ;
- ouvrir directement la meilleure page ;
- contourner l'accueil quand elle n'apporte rien.

Exemple concret :
- si une session est active et que la page `mail` est le prochain point logique, Browser Use y amene directement l'utilisateur.

### 7.4 Ce qui reste hors V2 sur cette page

A reserver plus tard :
- orchestration proactive complete de debut de session ;
- lancement automatique d'un workflow complexe depuis l'accueil.

## 8. Sequencement concret de developpement

### Etape 1

Ajouter l'interface de pilotage V2 dans la page parametres ou mails :
- activer ou desactiver Browser Use ;
- choisir le niveau V2 ;
- afficher la politique active.

### Etape 2

Implementer les sessions navigateur V2 sur la page mails :
- `open_inbox`
- `open_message`
- `prepare_reply`
- `inject_reply`

### Etape 3

Brancher un adaptateur Browser Use reel en mode simulation.

### Etape 4

Ajouter le pilotage de confort et de garde-fous sur la page parametres.

### Etape 5

Ajouter ensuite la connexion assistee sur la page compte et la reprise de contexte sur l'accueil.

## 9. Recommandation finale

Si l'on veut une V2 utile rapidement, il ne faut pas disperser l'effort.

La meilleure premiere version V2 semble etre :
- page mails :
  navigation inbox + ouverture mail + scroll + injection du brouillon ;
- page parametres :
  activation du mode V2 + garde-fous ;
- page compte :
  connexion assistee legere ;
- page d'accueil :
  reprise de contexte simple.

Autrement dit :
- le vrai coeur de la V2 doit etre `mail.html` ;
- `settings.html` doit devenir le tableau de bord de cette automatisation.
