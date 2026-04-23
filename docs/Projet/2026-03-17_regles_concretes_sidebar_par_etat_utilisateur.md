# Regles concretes de sidebar par etat utilisateur

Date : 2026-03-17

## 1. Objet du document

Ce document traduit la specification de navigation publique / privee en regles concretes de sidebar.

Il sert a definir :
- ce qui doit etre affiche ;
- ce qui doit etre masque ;
- ce qui doit etre desactive ;
- selon l'etat du visiteur ou du compte.

## 2. Principe general

La sidebar ne doit pas etre identique pour tout le monde.

Elle doit dependre de l'etat utilisateur.

Les etats minimums retenus sont :
- visiteur externe ;
- demande en attente ;
- compte valide non connecte ;
- compte connecte ;
- administrateur connecte.

## 3. Regles par etat

### 3.1 Visiteur externe

Definition :
- aucun compte actif ;
- aucune session ouverte.

Sidebar autorisee :
- `Accueil`
- `Compte`

Sidebar interdite :
- `Mails`
- `Parametres`
- `Regles`
- `Statistiques`
- `Versions`
- `Sauvegardes`

Comportement recommande :
- ne pas afficher les pages privees ;
- ou les afficher grisees seulement si on veut rendre la structure du produit visible ;
- mais l'acces direct doit rester bloque cote serveur.

### 3.2 Demande en attente

Definition :
- la personne a depose une demande ;
- le compte n'est pas encore valide ;
- aucune session produit metier n'est ouverte.

Sidebar autorisee :
- `Accueil`
- `Compte`

Contenu attendu de `Compte` :
- etat de la demande ;
- pieces justificatives manquantes ;
- demande de complement ;
- rappel du type de compte et du mode d'usage.

### 3.3 Compte valide non connecte

Definition :
- le compte a ete approuve ;
- l'utilisateur n'a pas encore ouvert sa session.

Sidebar autorisee :
- `Accueil`
- `Compte`

Contenu attendu de `Compte` :
- formulaire de connexion ;
- etat du compte ;
- version autorisee ;
- information sur les prochaines etapes.

### 3.4 Compte connecte

Definition :
- le compte est valide ;
- la session est ouverte ;
- le compte est actif.

Sidebar minimale autorisee :
- `Accueil`
- `Compte`
- `Mails`
- `Parametres`
- `Regles`

Sidebar conditionnelle :
- `Statistiques`
- `Versions`
- `Sauvegardes`

Condition d'affichage :
- selon le role ;
- selon les droits ;
- selon la version de produit autorisee ;
- selon les boites mail rattachees si necessaire.

### 3.5 Administrateur connecte

Definition :
- compte administrateur protege ;
- session ouverte.

Sidebar autorisee :
- toutes les pages privees autorisees ;
- future page `Administration` ;
- futures pages de supervision et de comptabilite.

## 4. Regles pratiques d'affichage

### Option recommandee a court terme

Pour le debut, la regle la plus simple est :

- en public : afficher seulement `Accueil` et `Compte`
- en prive : afficher la sidebar produit complete selon les droits

Cette option est la plus claire et la moins ambigue.

### Regle de secours

Si on veut montrer l'existence d'autres fonctions sans les ouvrir :
- les liens peuvent etre visibles mais desactives ;
- un message simple doit alors expliquer :
  - `Acces apres validation du compte`
  - ou `Disponible apres connexion`

Mais cette solution doit rester secondaire.

## 5. Rattachement des pages a la sidebar

### Sidebar publique

Pages visibles :
- `Accueil`
- `Compte`

Fonctions de `Compte` :
- demande d'ouverture ;
- suivi de demande ;
- ajout de justificatif ;
- connexion ;
- plus tard consultation du profil simplifie.

### Sidebar privee utilisateur

Pages visibles selon droits :
- `Accueil`
- `Compte`
- `Mails`
- `Parametres`
- `Regles`
- `Statistiques`
- `Versions`
- `Sauvegardes`

### Sidebar privee administrateur

Pages visibles :
- tout ce qui est accessible a l'utilisateur ;
- plus :
  - `Administration`
  - demandes d'ouverture ;
  - comptes ;
  - boites mail ;
  - supervision ;
  - comptabilite plus tard.

## 6. Regles d'acces a rappeler

Masquer une entree de sidebar ne suffit jamais.

Chaque page devra plus tard verifier :
- si une session existe ;
- si le compte est valide ;
- si le compte est actif ;
- si le role autorise la page ;
- si la version du produit autorise la page ;
- si les droits sur les boites mail sont suffisants.

## 7. Rattachement a la page Compte

La page `Compte` est speciale.
Elle joue deux roles selon l'etat utilisateur :

### Avant activation
- demande d'ouverture ;
- suivi de demande ;
- transmission de justificatifs ;
- connexion si le compte est valide.

### Apres activation
- profil ;
- version autorisee ;
- boites mail rattachees ;
- droits visibles ;
- informations de facturation plus tard.

## 8. Recommandation de mise en oeuvre

Ordre recommande :

1. definir une notion d'etat utilisateur dans le serveur ;
2. definir une notion de session ;
3. servir une sidebar publique par defaut ;
4. basculer vers une sidebar privee une fois la session validee ;
5. controler l'acces reel aux pages ;
6. seulement ensuite affiner selon les roles et versions de produit.

## 9. Resume executif

La regle concrete de sidebar doit etre la suivante :

### Sans connexion
- `Accueil`
- `Compte`

### Avec connexion utilisateur
- pages produit selon droits et version

### Avec connexion administrateur
- pages produit + pages d'administration

Cette logique est la plus propre pour :
- l'entree dans le produit ;
- la validation des comptes ;
- les futurs droits ;
- la facturation ;
- et les versions 1, 2 et 3.
