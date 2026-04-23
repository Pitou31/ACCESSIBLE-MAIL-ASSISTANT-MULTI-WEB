# Specification - navigation publique, navigation privee et etats utilisateur

Date : 2026-03-17

## 1. Objet du document

Ce document fixe une regle importante pour la suite du produit :
- l'application ne doit pas exposer toutes ses pages a un visiteur non authentifie ;
- les ecrans visibles doivent dependre de l'etat du compte et de la session ;
- la navigation doit donc etre differenciee entre partie publique et partie privee.

Cette specification complete la reflexion sur :
- les comptes ;
- les demandes d'ouverture ;
- les droits ;
- les boites mail ;
- la future facturation ;
- les versions du produit.

## 2. Principe directeur

Le site vu de l'exterieur ne doit pas presenter toute l'application.

Sans compte actif et sans session ouverte, l'utilisateur ne doit avoir acces qu'a une partie publique tres limitee.

La regle retenue est la suivante :

### Navigation publique

Accessible sans compte actif :
- `Accueil`
- `Compte`

### Navigation privee

Accessible seulement apres validation du compte puis connexion :
- `Mails`
- `Parametres`
- `Regles`
- `Statistiques`
- `Versions`
- `Sauvegardes`
- futures pages metier

## 3. Pourquoi cette separation est necessaire

Cette separation est utile pour :
- eviter qu'un visiteur voie des ecrans non utilisables ;
- clarifier le parcours d'entree dans le produit ;
- ne pas exposer inutilement les fonctions metier ;
- preparer la gestion des droits et de la facturation ;
- rendre la future gestion de compte plus propre.

## 4. Role de la page Compte

La page `Compte` devient la veritable porte d'entree controlee du produit.

Elle doit regrouper :
- la demande d'ouverture de compte ;
- le suivi de la demande ;
- la connexion ;
- plus tard la consultation du profil, des boites mail autorisees, des droits, de la version du produit et de la facturation.

La page `Compte` ne doit donc pas etre consideree comme une simple page secondaire de l'application.
Elle fait partie du parcours public.

## 5. Etats utilisateur a distinguer

Le produit doit distinguer au minimum les etats suivants.

### 5.1 Visiteur externe

Profil :
- aucun compte actif ;
- aucune session ouverte ;
- simple visiteur du site.

Pages visibles :
- `Accueil`
- `Compte`

Pages inaccessibles :
- `Mails`
- `Parametres`
- `Regles`
- `Statistiques`
- `Versions`
- `Sauvegardes`

### 5.2 Demande en attente

Profil :
- une demande d'ouverture existe ;
- le compte n'est pas encore valide ;
- aucune utilisation metier n'est autorisee.

Pages visibles :
- `Accueil`
- `Compte`

Fonctions utiles dans `Compte` :
- voir l'etat de la demande ;
- transmettre un complement ;
- ajouter un justificatif si demande.

### 5.3 Compte valide non connecte

Profil :
- le compte a ete approuve ;
- aucune session n'est encore ouverte.

Pages visibles :
- `Accueil`
- `Compte`

Fonctions utiles dans `Compte` :
- connexion ;
- information sur l'etat du compte ;
- plus tard premiere activation.

### 5.4 Compte connecte et actif

Profil :
- le compte est valide ;
- la session est ouverte ;
- le compte est actif.

Pages visibles :
- `Accueil`
- `Compte`
- toutes les pages autorisees par le role, la version du produit et les droits.

### 5.5 Administrateur connecte

Profil :
- compte administrateur protege ;
- session ouverte.

Pages visibles :
- navigation privee complete ;
- futures pages d'administration ;
- gestion des demandes ;
- supervision ;
- comptabilite plus tard.

## 6. Tableau de visibilite des pages

### Visiteur externe
- `Accueil` : oui
- `Compte` : oui
- `Mails` : non
- `Parametres` : non
- `Regles` : non
- `Statistiques` : non
- `Versions` : non
- `Sauvegardes` : non

### Demande en attente
- `Accueil` : oui
- `Compte` : oui
- reste de l'application : non

### Compte valide non connecte
- `Accueil` : oui
- `Compte` : oui
- reste de l'application : non

### Compte connecte
- `Accueil` : oui
- `Compte` : oui
- `Mails` : oui si autorise
- `Parametres` : oui si autorise
- `Regles` : oui si autorise
- `Statistiques` : oui si autorise
- `Versions` : oui si autorise
- `Sauvegardes` : oui si autorise

### Administrateur connecte
- acces complet selon les politiques d'administration.

## 7. Ce que cela implique pour la sidebar

La sidebar ne doit pas etre unique et aveugle.
Elle doit devenir dependante de l'etat utilisateur.

Deux strategies sont possibles :

### Option A - Deux sidebars

- une sidebar publique
- une sidebar privee

Avantages :
- tres claire ;
- plus simple a raisonner ;
- propre pour le parcours de connexion.

### Option B - Une sidebar dynamique

- les liens visibles changent selon l'etat de session.

Avantages :
- moins de duplication.

Inconvenient :
- un peu plus de logique de rendu.

### Recommandation

Commencer par une logique simple :
- navigation publique minimaliste pour le visiteur ;
- navigation privee seulement pour l'utilisateur connecte.

Le plus important n'est pas l'elegance technique mais la clarte du parcours.

## 8. Point critique : masquer ne suffit pas

Le simple fait de cacher des liens dans la sidebar n'est pas suffisant.

Il faut aussi proteger l'acces reel aux pages.

Cela veut dire qu'il faudra plus tard :
- verifier la session ;
- verifier le statut du compte ;
- verifier le role ;
- verifier les droits ;
- refuser l'acces direct par URL si la page n'est pas autorisee.

## 9. Lien avec la facturation

Cette logique est importante aussi pour la facturation.

Tant qu'un compte :
- n'est pas valide ;
- n'est pas active ;
- ou n'est pas autorise sur une certaine version du produit ;

il ne doit pas acceder a des fonctions qui relevent d'un usage produit effectif.

La navigation privee devra donc plus tard etre conditionnee aussi par :
- la version autorisee ;
- le statut d'abonnement ou de gratuit e ;
- les droits du compte.

## 10. Lien avec les boites mail

Apres connexion, l'utilisateur ne doit pas voir seulement "l'application".
Il doit voir l'application dans la limite de :
- ses droits ;
- ses boites mail autorisees ;
- sa version de produit ;
- ses parametres actifs.

La navigation privee sera donc elle-meme sous-structuree par :
- le compte ;
- les boites mail ;
- les droits sur ces boites.

## 11. Recommandation de mise en oeuvre

Ordre recommande :

1. documenter officiellement la separation public / prive ;
2. faire apparaitre `Compte` comme point d'entree public principal ;
3. reduire la navigation publique a `Accueil` et `Compte` ;
4. preparer une logique de session ;
5. preparer une logique de statut de compte ;
6. activer ensuite la navigation privee selon les droits reels.

## 12. Resume executif

Le produit doit etre pense comme deux couches :

### Couche publique
- `Accueil`
- `Compte`

### Couche privee
- toutes les pages metier, visibles seulement apres validation et connexion.

La page `Compte` doit etre la charniere entre ces deux mondes :
- demande d'ouverture ;
- validation ;
- connexion ;
- puis acces au produit.
