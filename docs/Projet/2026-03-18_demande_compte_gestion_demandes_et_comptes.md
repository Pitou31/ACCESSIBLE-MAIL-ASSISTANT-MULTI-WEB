# Demande de compte, gestion des demandes et gestion des comptes

## 1. Objet

Ce document fixe le fonctionnement actuel de l'application pour :

- la demande d'ouverture de compte,
- la gestion des demandes par l'administrateur,
- la gestion des comptes par l'administrateur.

Il décrit l'etat reel du projet tel qu'il est maintenant implemente dans l'application.

## 2. Principes generaux

- Un compte usager est demande depuis la page `Compte`.
- Une demande cree automatiquement une entree dans la base pour la demande.
- Une demande cree aussi automatiquement un compte usager lie, en attente d'activation ou d'examen.
- L'administrateur traite ensuite la situation depuis une page privee.
- Les actions administrateur importantes envoient un mail a l'administrateur et a l'usager.
- L'application conserve une tracabilite des actions dans la base.

## 3. Pages concernees

### 3.1. Cote usager

- `account.html`
  Cette page sert de point d'entree.
  Elle permet :
  - de verifier le statut d'un compte,
  - de se connecter,
  - d'acceder a la demande d'ouverture de compte.

- `account-request.html`
  Cette page sert a deposer une demande d'ouverture de compte.

### 3.2. Cote administrateur

- `admin-bootstrap.html`
  Page secrete permettant de creer le premier administrateur principal.
  Cette page n'est plus destinee a creer les administrateurs suivants.

- `admin-db.html`
  Page privee de controle permettant a l'administrateur de :
  - voir les demandes utiles,
  - voir les comptes,
  - valider, suspendre, refuser ou supprimer selon le cas,
  - creer d'autres administrateurs.

## 4. Base de donnees

La base active est :

- `backend/data/agent-mail-assistant.db`

Les tables principales utilisees ici sont :

- `account_requests`
- `accounts`
- `account_actions`
- `mailboxes`
- `user_stats`
- `billing_profiles`
- `invoices`

## 5. Fonctionnement de la demande de compte

Quand l'usager depose une demande depuis `account-request.html` :

1. le formulaire est valide,
2. la demande est enregistree dans `account_requests`,
3. un compte usager lie est cree automatiquement dans `accounts`,
4. un mail d'alerte est envoye a l'administrateur.

### 5.1. Champs principaux de la demande

- type de compte
- mode d'usage
- prenom
- nom
- email
- telephone
- organisation
- mention d'usage : handicape
- boites mail prevues
- contexte d'usage
- justificatif
- consentement

### 5.2. Statuts de demande actuellement utilises

- `pending`
- `more_info_requested`
- `approved`
- `rejected`
- `deleted`

## 6. Fonctionnement du compte cree automatiquement

Lors d'une demande :

- un compte usager est cree automatiquement,
- il est rattache a la demande,
- il porte un type de compte et un email,
- il pourra ensuite etre active, suspendu ou supprime.

### 6.1. Statuts de compte actuellement utilises

- `pending_activation`
- `active`
- `suspended`
- `rejected`

## 7. Gestion des demandes par l'administrateur

Depuis `admin-db.html`, l'administrateur peut agir sur les demandes visibles.

### 7.1. Actions disponibles sur une demande

- `Valider`
- `Complements`
- `Refuser`

### 7.2. Effets de chaque action

#### Valider

- la demande passe a `approved`,
- si aucun compte n'est encore lie, le systeme cree automatiquement le compte manquant,
- le compte lie est alors active,
- la version choisie est enregistree,
- un mail est envoye a l'administrateur et a l'usager.

#### Complements

- la demande passe ou reste a `more_info_requested`,
- la note administrateur peut expliquer ce qui manque,
- le compte n'est pas force a etre actif par cette action,
- un mail est envoye a l'administrateur et a l'usager.

#### Refuser

- la demande passe a `rejected`,
- si un compte lie existe, il passe a `rejected`,
- un mail est envoye a l'administrateur et a l'usager.

## 8. Gestion des comptes par l'administrateur

Depuis `admin-db.html`, l'administrateur peut agir sur les comptes visibles.

### 8.1. Actions disponibles sur un compte

- `Activer`
- `Suspendre`
- `Supprimer`

### 8.2. Effets de chaque action

#### Activer

- le compte passe a `active`,
- un mot de passe temporaire peut etre defini,
- un mail est envoye a l'administrateur et a l'usager.

#### Suspendre

- le compte passe a `suspended`,
- l'usager ne doit plus pouvoir utiliser normalement l'application,
- un mail est envoye a l'administrateur et a l'usager.

#### Supprimer

- le compte est supprime physiquement de `accounts`,
- les rattachements techniques associes sont nettoyes,
- la demande source est marquee `deleted`,
- la demande supprimee ne s'affiche plus dans la vue standard,
- un mail est envoye a l'administrateur et a l'usager.

## 9. Regles d'affichage actuelles

### 9.1. Demandes affichees

Par defaut, la page administrateur n'affiche pas :

- les demandes `deleted`,
- les demandes deja consommees par un compte lie et actif.

Cela permet de garder une liste de travail centree sur les dossiers encore utiles.

### 9.2. Comptes affiches

Les comptes sont affiches avec :

- identite,
- role,
- type,
- usage,
- statut,
- version,
- demande source.

Les boutons sont visuellement differencies :

- `Activer` en vert,
- `Suspendre` en orange,
- `Supprimer` en rouge.

Un bouton incoherent avec l'etat courant est desactive :

- `Deja actif`
- `Deja suspendu`

## 10. Protection de l'administrateur principal

Un compte administrateur :

- reste visible dans la liste des comptes,
- ne peut pas etre supprime depuis `admin-db.html`.

Cette protection a ete ajoutee apres qu'une suppression admin accidentelle ait ete constatee pendant les tests.

## 10 bis. Création d'administrateurs supplémentaires

Les administrateurs supplementaires ne sont pas crees depuis `admin-bootstrap.html`.

Ils sont crees depuis `admin-db.html` par un administrateur deja present.

Le formulaire permet de saisir :

- prenom,
- nom,
- email,
- telephone,
- mot de passe initial.

Effets :

- creation d'un compte `admin`,
- compte actif immediatement,
- envoi d'un mail a l'administrateur createur et a l'administrateur cree.

Depuis `admin-db.html`, un administrateur peut aussi reinitialiser le mot de passe d'un autre administrateur.

Le mot de passe temporaire saisi dans l'espace admin sert alors de nouveau mot de passe.

## 11. Cause du probleme observe pendant les suppressions

Le probleme constate n'etait pas une suppression automatique en chaine d'autres comptes.

La cause principale etait une interface insuffisamment protectrice :

- apres suppression d'un compte, la liste etait rechargee,
- le compte suivant pouvait se retrouver a la place du precedent,
- un nouveau clic pouvait alors viser un autre compte,
- notamment l'administrateur.

Les corrections appliquees sont :

- confirmation explicite avant suppression,
- protection des comptes administrateur,
- affichage plus coherent apres action.

## 12. Cas metier particulier accepte

Il est admis qu'une demande puisse rester en `more_info_requested`
alors que le compte correspondant est `active`.

Cela correspond a un vrai cas metier :

- l'usager ne souhaite pas fournir certaines informations,
- l'administrateur decide tout de meme d'activer le compte.

Dans ce cas :

- le compte gouverne l'acces reel,
- la demande n'a plus vocation a rester visible dans la liste courante si le compte est deja actif.

## 13. Connexion usager

Depuis `account.html`, l'usager peut :

- verifier son statut,
- choisir son type de compte,
- tenter une connexion.

Le systeme controle alors :

- l'existence du compte pour l'email et le type choisis,
- le statut du compte,
- la presence d'un mot de passe initialisé,
- la validite du mot de passe.

## 14. Conseils de gestion

### 14.1. Quand utiliser `Suspendre`

Utiliser `Suspendre` si :

- il faut bloquer temporairement l'acces,
- il faut attendre un echange avec l'usager,
- il ne faut pas effacer l'historique du compte.

### 14.2. Quand utiliser `Supprimer`

Utiliser `Supprimer` seulement si :

- le compte doit disparaitre reellement,
- il faut repartir proprement,
- la situation est grave ou definitive.

Exemples :

- deces,
- fraude,
- erreur lourde de creation,
- demande expresse de suppression definitive.

## 15. Etat du socle

Le socle actuel permet deja :

- de deposer une demande,
- de creer automatiquement un compte lie,
- d'administrer demandes et comptes,
- de suspendre, activer et supprimer,
- d'envoyer les alertes mail,
- de journaliser les actions.

La prochaine etape naturelle sera :

- de renforcer encore la securite du parcours,
- puis d'ouvrir le traitement reel des boites mail a des comptes effectivement actives.
