# Plan concret - version 1 sans Browser Use

Date : 2026-03-17

## 1. Objet du document

Ce document fixe la base de travail prioritaire pour la version 1 du produit.

Cette version 1 est volontairement :
- locale ;
- sobre ;
- controlee ;
- sans automatisation `Browser Use`.

L'objectif est de construire un premier systeme reel de gestion assistee des mails avant d'ouvrir les versions plus automatisees.

## 2. Principe directeur

La priorite absolue n'est pas l'automatisation navigateur.
La priorite est :
- d'acceder a une ou plusieurs boites mail ;
- de recuperer les messages utiles ;
- de les stocker proprement ;
- de les classer ;
- de les traiter ;
- de produire une reponse ;
- de mettre a jour leur statut ;
- le tout dans un cadre local, comprehensible et maitrisable.

`Browser Use` sera traite plus tard, comme une couche supplementaire.

## 3. Priorite fonctionnelle retenue

La version de base doit permettre le cycle suivant :

1. disposer d'un jeu d'essai ou d'une boite reelle en simulation ;
2. etablir un compte utilisateur et ses droits ;
3. acceder a la boite mail sans Browser Use ;
4. selectionner les mails a traiter ;
5. stocker ces mails dans une structure locale ;
6. leur attribuer une priorite, une categorie et un statut ;
7. les traiter dans un ordre maitrise ;
8. mettre a jour la boite mail ;
9. ajouter le contenu de la reponse pour les messages valides.

## 4. Etape 0 - Jeu d'essai

Avant tout branchement avance, il faut un cadre de test stable.

Deux options sont possibles :

### Option A - Jeu d'essai local

Utiliser un ensemble de mails de test prepares a l'avance.

Avantages :
- tres sur ;
- reproductible ;
- ideal pour les premiers tests ;
- aucun risque d'envoi reel.

Inconvenients :
- moins proche d'un usage reel ;
- ne valide pas la connexion a une vraie boite.

### Option B - Boites reelles en simulation

Utiliser une ou plusieurs boites mail reelles mais dans un cadre strict de simulation.

Avantages :
- plus proche du reel ;
- valide l'acces a la boite ;
- teste les vrais formats de messages.

Inconvenients :
- plus sensible ;
- demande plus de precautions ;
- risque de confusion si la separation simulation / reel n'est pas stricte.

### Recommandation

Commencer par un jeu d'essai local, puis ouvrir ensuite une ou plusieurs boites reelles en mode simulation.

## 5. Etape 1 - Compte utilisateur

Le produit doit permettre de definir un compte utilisateur local avec les informations deja identifiees.

### Informations minimales

- identite ;
- coordonnees ;
- role ;
- droits ;
- version autorisee de l'application ;
- boites mail autorisees ;
- parametres utilisateur utiles.

### Version d'application rattachee a l'utilisateur

Chaque compte devra pouvoir etre lie a une version autorisee :
- `base`
- `automatisation_legere`
- `automatisation_poussee`

Dans l'immediat, seule la version `base` doit etre activee.

### Boites mail rattachees

Un utilisateur pourra etre rattache a :
- une seule boite ;
- ou plusieurs boites.

Ce point doit etre pense des le depart.

## 6. Etape 2 - Acces a la boite mail sans Browser Use

Le produit doit pouvoir acceder a la boite mail sans passer par une automatisation navigateur.

Objectifs :
- ouvrir la boite ;
- lire les messages ;
- recuperer leur contenu ;
- travailler localement dessus.

Important :
- aucune dependance a Browser Use dans cette version ;
- aucune confusion avec la future version automatisee.

## 7. Etape 3 - Selection des mails a traiter

Le produit doit pouvoir selectionner les mails a traiter.

### Regle de base

Les mails non encore traites doivent etre identifies automatiquement.

### Premier flux retenu

1. lire les messages disponibles ;
2. detecter ceux qui ne sont pas encore traites ;
3. les marquer comme `en attente de traitement` dans le systeme local ;
4. eviter qu'un meme message soit traite deux fois sans raison.

## 8. Etape 4 - Stockage local

Les mails a traiter doivent etre stockes dans une structure locale.

Le choix exact entre fichier et base de donnees reste a arbitrer, mais la structure logique doit etre prete.

### Champs minimums recommandes

- identifiant du message ;
- identifiant de la boite mail ;
- expediteur ;
- destinataire ;
- objet ;
- date de reception ;
- contenu brut ;
- contenu nettoye ;
- categorie ;
- priorite ;
- statut ;
- brouillon de reponse ;
- date de dernier traitement ;
- utilisateur ayant traite ;
- notes eventuelles.

## 9. Etape 5 - Priorisation et categorisation

Une fois stockes, les messages doivent recevoir :
- une priorite ;
- une categorie ;
- un statut initial.

### Priorites simples a retenir

- `haute`
- `normale`
- `basse`

### Categories minimales possibles

- `administratif`
- `information`
- `demande`
- `urgent`
- `a_confirmer`
- `autre`

### Statut initial

Le premier statut utile est :
- `en_attente_de_traitement`

## 10. Etape 6 - Traitement des mails

Les messages doivent ensuite etre traites dans un ordre maitrise.

### Regle de traitement

Traiter d'abord :
- les priorites hautes ;
- puis normales ;
- puis basses.

### Statuts recommandes pendant le traitement

- `en_attente_de_traitement`
- `en_cours`
- `valide`
- `rejete`
- `supprime`

### Sens des statuts

`valide`
- le traitement est juge correct ;
- une reponse peut etre associee.

`rejete`
- le mail est classe comme non retenu pour reponse dans ce flux.

`supprime`
- le message est marque comme ecarte ou a retirer selon la politique retenue.

## 11. Etape 7 - Mise a jour de la boite mail

Une fois le traitement realise, le resultat doit pouvoir etre repercute sur la boite mail.

Actions visees :
- marquer le mail comme traite ;
- marquer le mail comme rejete ;
- marquer le mail comme supprime ;
- laisser une trace de son etat.

Important :
- cette mise a jour devra d'abord etre testee en simulation ;
- il faudra eviter toute action irreversible trop tot.

## 12. Etape 8 - Ajout de la reponse pour les messages valides

Pour les messages `valides`, le produit doit pouvoir :
- conserver la reponse produite ;
- l'associer au message ;
- la preparer pour une reinjection ulterieure dans la boite ;
- puis, plus tard, l'envoyer reellement selon les politiques autorisees.

Dans la version 1 :
- la reponse doit d'abord etre geree en simulation ;
- l'envoi reel pourra venir ensuite, de facon encadree.

## 13. Deux exigences transversales a ne pas oublier

### 13.1 Journalisation

Chaque etape devra pouvoir etre tracee :
- utilisateur ;
- boite mail ;
- message ;
- action ;
- date ;
- resultat.

### 13.2 Separation simulation / reel

Le systeme doit distinguer clairement :
- le mode `simulation`
- le mode `reel`

Cette separation est indispensable pour :
- tester sans risque ;
- eviter les envois involontaires ;
- valider les parcours avant ouverture progressive.

## 14. Recommandation technique initiale

Pour la version 1, une architecture simple est recommandee :

- un compte utilisateur local ;
- une liste de boites mail autorisees ;
- un mecanisme d'acces direct a la boite ;
- un stockage local des messages ;
- une logique de priorisation ;
- un flux de traitement manuel assiste ;
- un mecanisme de mise a jour du statut ;
- une journalisation minimale.

## 15. Ce qu'il faut faire demain en premier

Ordre de travail recommande :

1. transformer ce plan en specification de reference validee ;
2. choisir la strategie de jeu d'essai ;
3. definir la structure du compte utilisateur local ;
4. definir la structure de stockage des mails ;
5. definir les statuts et transitions ;
6. seulement ensuite discuter le branchement concret a une boite mail.

## 16. Resume executif

La vraie base du produit est la suivante :

- une version 1 sans Browser Use ;
- un acces a la boite mail sans automatisation navigateur ;
- une gestion locale des messages ;
- une priorisation et une categorisation claires ;
- un traitement progressif ;
- une mise a jour de statut ;
- une reponse associee aux messages valides ;
- une separation stricte entre simulation et reel.

Cette base doit etre stabilisee avant d'ouvrir les versions automatisees.
