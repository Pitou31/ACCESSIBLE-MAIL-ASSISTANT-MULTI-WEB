# Traitement manuel de réponse aux mails

## Objet

Ce document décrit le processus manuel actuel de traitement des mails dans l'application.
Il sera complété plus tard avec le traitement automatisé.

## Principe général

Le traitement manuel part de la liste des mails affichés dans la page `Gestion des mails`.

L'utilisateur :
- choisit un mail dans la liste `Inbox connectée`
- clique sur `Ouvrir dans Répondre au mail`
- lit le contenu reçu
- choisit le modèle LLM
- clique sur `Générer la réponse`
- relit et modifie la réponse si nécessaire
- clique ensuite sur `Valider l’envoi`, `Rejet` ou `Suppression`

## Préconditions

Avant de traiter un mail, il faut :
- être connecté à l'application avec un compte actif
- avoir connecté une boîte Gmail via OAuth
- voir la boîte en statut `connected`
- avoir chargé l'Inbox

## Séquence manuelle détaillée

### 1. Sélection du mail

Dans la liste des mails :
- l'utilisateur repère un message
- clique sur `Ouvrir dans Répondre au mail`

Effets :
- le mode `Répondre au mail` s'active
- le scroll descend automatiquement vers la zone de réponse
- le contenu du mail est chargé
- les pièces jointes détectées sont listées

### 2. Lecture du mail

L'utilisateur peut :
- lire visuellement le mail
- lancer la lecture audio
- vérifier les pièces jointes détectées

### 2 bis. Classification et priorité

Chaque mail reçu fait désormais l'objet d'un traitement d'analyse modulaire.

Cette analyse produit au minimum :
- une classification
- une priorité

Objectif :
- exploiter ces informations aussi bien pour le traitement manuel que pour le traitement automatique futur

Affichage actuel :
- dans la liste `Inbox connectée`
- dans le bandeau de traitement quand un mail est ouvert

Exemples de classification actuels :
- `Demande d'information`
- `Question facture`
- `Demande de document`
- `Réclamation`
- `Relance`
- `Autre`

Exemples de priorité actuels :
- `Normale`
- `Urgente`

Point d'architecture :
- le traitement est maintenant modulaire
- il ne doit pas dépendre du seul écran manuel
- il doit être réutilisable plus tard dans le traitement automatique

### 3. Choix du modèle

L'utilisateur choisit le LLM dans le bandeau du haut ou dans le bandeau du bas.

Les deux sélecteurs sont synchronisés.

### 4. Génération de la réponse

L'utilisateur clique sur :
- `Générer la réponse`
ou
- `Régénérer avec le LLM choisi`

Effets :
- avant toute génération finale, le backend doit d'abord évaluer si le contexte est suffisant
- le contenu du mail reçu est confronté aux règles métier disponibles
- si le contexte est insuffisant, le système ne doit pas produire une réponse définitive trompeuse
- le backend construit le prompt de réponse
- le contenu du mail reçu est transmis au LLM
- le résumé des pièces jointes détectées est transmis au LLM
- les règles métier ou consignes disponibles doivent aussi être transmises au LLM
- la réponse générée apparaît dans la zone `Réponse au mail`

### 4 bis. Contrôle de complétude du contexte

Avant de répondre, le système doit déterminer si les informations disponibles sont suffisantes.

Sources à prendre en compte :
- mail reçu
- pièces jointes traitées
- règles métier
- autres contextes explicitement fournis

Si le contexte est insuffisant :
- l'IA ne doit pas inventer l'information manquante
- elle doit produire soit :
  - une réponse prudente ;
  - une demande d'information complémentaire ;
  - ou un signal indiquant qu'une source externe autorisée sera nécessaire plus tard

### 5. Relecture et correction

L'utilisateur peut :
- modifier le texte
- écouter la réponse en audio
- relancer une génération avec un autre modèle

## Aides futures à la modification manuelle

Une étude complémentaire est prévue pour ajouter des aides locales de modification du texte.

Exemples visés :
- supprimer un texte sélectionné
- modifier uniquement un texte sélectionné
- insérer un ajout à partir de la position du curseur
- compléter la phrase en cours
- proposer des mots probables pendant la saisie

Ce sujet est détaillé dans :
- `2026-03-20_aides_modification_manuelle_reponse_mail.md`

## Produits ou briques existants à étudier

Pour éviter une partie du développement spécifique, plusieurs pistes de produits ou briques existants ont été identifiées.

### Pour la correction locale

- `LanguageTool`

Intérêt :
- orthographe
- grammaire
- style
- intégration API possible

### Pour la réécriture dans l'éditeur

- `TinyMCE AI Assistant`
- `CKEditor AI`

Intérêt :
- réécriture de sélection
- insertion contextuelle
- transformation de texte
- actions rapides dans l'éditeur

### Pour l'autocomplétion

Il n'existe pas à ce stade une solution unique évidente couvrant parfaitement le besoin métier :
- mots probables
- suite de phrase
- insertion locale fine
- comportement adapté aux réponses mails en français métier

Conclusion provisoire :
- une partie du besoin peut probablement être couverte par des produits existants
- mais une couche spécifique applicative restera probablement nécessaire pour le comportement fin attendu

## Traitements disponibles

### A. Valider l’envoi

But :
- envoyer la réponse au demandeur
- sortir le mail de la liste de traitement
- marquer le mail comme traité

Effets actuels :
1. la réponse est envoyée au demandeur depuis la boîte Gmail connectée
2. le mail source reçoit le label Gmail `AMA_TRAITE`
3. le mail source est retiré de l'Inbox visible dans l'application
4. l'action est enregistrée dans la base dans `mailbox_message_actions`
5. l'Inbox est rechargée

Important :
- aujourd'hui, le mail disparaît de la page uniquement après succès de l'appel backend
- ce backend considère le traitement réussi seulement si l'API Gmail a répondu positivement pour :
  - l'envoi du message
  - puis la mise à jour du mail source
- il ne s'agit pas d'une vérification visuelle dans l'interface Gmail
- il s'agit d'une confirmation technique par l'API Gmail

### B. Rejet

But :
- informer le demandeur que son mail est rejeté
- sortir le mail de la liste de traitement
- marquer le mail comme rejeté

Effets actuels :
1. l'utilisateur doit saisir un motif de rejet
2. un mail de confirmation de rejet est envoyé au demandeur
3. le mail source reçoit le label Gmail `AMA_REJETE`
4. le mail source est retiré de l'Inbox visible dans l'application
5. l'action est enregistrée dans la base
6. l'Inbox est rechargée

### C. Suppression

But :
- informer le demandeur que le message est supprimé
- sortir le mail de la liste de traitement
- marquer le mail comme supprimé

Usage typique :
- spam
- contenu hors périmètre
- message à ne pas traiter

Effets actuels :
1. l'utilisateur doit saisir un motif de suppression
2. un mail de confirmation de suppression est envoyé au demandeur
3. le mail source reçoit le label Gmail `AMA_SUPPRIME`
4. le mail source est retiré de l'Inbox visible dans l'application
5. le mail source est déplacé dans la corbeille Gmail
6. l'action est enregistrée dans la base
7. l'Inbox est rechargée

## Contrôles recommandés après chaque traitement

Après chaque action, contrôler dans Gmail :

### Après validation
- `Messages envoyés`
- présence de la réponse envoyée
- disparition du mail de la boîte de réception
- présence du label `AMA_TRAITE`

### Après rejet
- `Messages envoyés`
- présence du mail de rejet
- disparition du mail de la boîte de réception
- présence du label `AMA_REJETE`

### Après suppression
- `Messages envoyés`
- présence du mail de suppression
- disparition du mail de la boîte de réception
- présence éventuelle du label `AMA_SUPPRIME`
- présence du mail dans `Corbeille`

## Traçabilité en base

Les traitements manuels sont maintenant enregistrés dans la table :
- `mailbox_message_actions`

Cette table conserve notamment :
- le compte applicatif
- la connexion boîte mail
- l'identifiant Gmail du message
- le type d'action
- le motif éventuel
- le sujet et le corps de réponse
- l'identifiant du message envoyé
- le statut final du message source

## Limites actuelles

- le passage automatique au mail suivant n'est pas encore implémenté
- le traitement automatique complet n'est pas encore branché
- la page `Règles` n'est pas encore opérationnelle comme vraie source métier de contexte
- le contrôle de complétude du contexte avant réponse IA doit encore être mis en place proprement
- la vérification finale dans Gmail reste un contrôle utilisateur recommandé

## Suite prévue

Le document sera complété avec :
- le traitement automatisé séquentiel
- le passage automatique au mail suivant
- les règles de décision automatiques
- les contrôles de cohérence complémentaires
