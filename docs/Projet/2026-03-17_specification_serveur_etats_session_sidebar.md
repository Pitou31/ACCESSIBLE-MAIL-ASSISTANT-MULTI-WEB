# Specification serveur - etats utilisateur, session et choix de sidebar

Date : 2026-03-17

## 1. Objet du document

Ce document traduit les regles de navigation publique / privee en logique serveur.

Il precise :
- comment le serveur determine l'etat utilisateur ;
- comment il decide quelle sidebar servir ;
- comment il autorise ou refuse une page ;
- comment preparer ensuite la logique de session et de droits.

## 2. Principe directeur

Le serveur ne doit pas seulement servir des pages statiques.
Il doit connaitre le contexte minimal de l'utilisateur pour choisir :
- la navigation publique ;
- la navigation privee ;
- ou un refus d'acces.

La regle est simple :
- si aucun compte actif n'est reconnu, le serveur reste en mode public ;
- si une session valide est reconnue, le serveur passe en mode prive selon les droits.

## 3. Etats utilisateur a connaitre cote serveur

Le serveur doit pouvoir distinguer au minimum :
- `public_visitor`
- `request_pending`
- `validated_not_logged_in`
- `active_user`
- `active_admin`

## 4. Sens de chaque etat

### `public_visitor`
- aucun compte reconnu ;
- aucune session ;
- acces public uniquement.

### `request_pending`
- une demande existe ;
- le compte n'est pas encore actif ;
- pas d'acces aux pages metier.

### `validated_not_logged_in`
- le compte est valide ;
- aucune session ouverte ;
- acces public seulement, avec possibilite de connexion.

### `active_user`
- session valide ;
- compte actif ;
- acces aux pages privees selon role, version et droits.

### `active_admin`
- session valide ;
- compte administrateur ;
- acces aux pages privees et pages d'administration.

## 5. Informations minimales a fournir au serveur

Pour prendre sa decision, le serveur devra pouvoir connaitre :
- l'existence ou non d'une session ;
- l'identifiant du compte si une session existe ;
- le statut du compte ;
- le role du compte ;
- la version de produit autorisee ;
- les droits principaux ;
- plus tard les boites mail autorisees.

## 6. Decision serveur attendue

Pour chaque requete de page, le serveur doit repondre a deux questions :

1. Quelle navigation dois-je servir ?
2. Cette page est-elle autorisee pour cet utilisateur ?

## 7. Regle de choix de sidebar

### Sidebar publique

A servir si l'etat est :
- `public_visitor`
- `request_pending`
- `validated_not_logged_in`

Contenu :
- `Accueil`
- `Compte`

### Sidebar privee utilisateur

A servir si l'etat est :
- `active_user`

Contenu :
- `Accueil`
- `Compte`
- pages produit selon droits et version autorisee

### Sidebar privee administrateur

A servir si l'etat est :
- `active_admin`

Contenu :
- sidebar privee utilisateur
- futures pages administration

## 8. Regle d'autorisation des pages

Le serveur doit verifier page par page.

### Pages publiques

Doivent toujours rester accessibles :
- `/index.html`
- `/frontend/account.html`

### Pages privees utilisateur

Doivent etre refusees si l'utilisateur n'est pas `active_user` ou `active_admin` :
- `/frontend/mail.html`
- `/frontend/settings.html`
- `/frontend/rules.html`
- `/frontend/stats.html`
- `/frontend/versions.html`
- `/frontend/backups.html`

### Pages privees administrateur

Doivent etre refusees si l'utilisateur n'est pas `active_admin` :
- futures pages d'administration
- futures pages de gestion des demandes
- futures pages de supervision

## 9. Comportement serveur recommande en cas d'acces interdit

Si une page privee est demandee sans droit :
- ne pas servir la page metier ;
- rediriger vers `Compte`
- ou servir une page d'acces refuse / connexion requise.

Recommendation :
- pour un compte non connecte : redirection vers `Compte`
- pour un compte connecte mais sans droit : page `Acces non autorise`

## 10. Logique de session recommandee

Le serveur doit preparer une vraie notion de session.

Cette session devra contenir au minimum :
- `user_id`
- `account_status`
- `role`
- `product_version`
- date de debut de session

Plus tard, elle pourra aussi contenir :
- boite mail active ;
- permissions derives ;
- contexte de traitement courant.

## 11. Algorithme simple de decision

Pour chaque requete :

1. detecter si une session existe ;
2. si aucune session :
   - etat = `public_visitor`
3. si session :
   - charger le compte ;
   - lire le statut ;
   - lire le role ;
4. determiner l'etat serveur ;
5. choisir la sidebar ;
6. verifier que la page demandee est autorisee ;
7. si oui, servir la page ;
8. sinon, rediriger ou refuser.

## 12. Mapping recommande page / etat

### `/index.html`
- tous etats autorises

### `/frontend/account.html`
- tous etats autorises

### `/frontend/mail.html`
- `active_user`
- `active_admin`

### `/frontend/settings.html`
- `active_user`
- `active_admin`

### `/frontend/rules.html`
- `active_user`
- `active_admin`

### `/frontend/stats.html`
- `active_user`
- `active_admin`

### `/frontend/versions.html`
- `active_user`
- `active_admin`

### `/frontend/backups.html`
- `active_user`
- `active_admin`

### futures pages `/frontend/admin-*`
- `active_admin` seulement

## 13. Ce que cela implique pour le serveur actuel

Le serveur actuel injecte deja une sidebar commune.

Il faudra le faire evoluer pour :
- choisir entre sidebar publique et sidebar privee ;
- ou injecter une sidebar dynamique selon un etat serveur ;
- verifier les pages avant de les servir ;
- preparer ensuite la gestion de session.

## 14. Strategies possibles

### Strategie A - Deux composants de sidebar

- `sidebar-public.html`
- `sidebar-private.html`
- plus tard `sidebar-admin.html`

Avantages :
- simple ;
- lisible ;
- robuste.

### Strategie B - Une sidebar unique generee dynamiquement

Avantages :
- moins de duplication.

Inconvenient :
- logique plus complexe.

### Recommandation

Commencer par :
- une sidebar publique ;
- une sidebar privee ;

et ajouter plus tard une variante admin si besoin.

## 15. Ordre de mise en oeuvre recommande

1. introduire une notion d'etat serveur fictive ou simulee ;
2. servir une sidebar publique par defaut ;
3. proteger les pages privees ;
4. mettre en place la page `Compte` comme point d'entree ;
5. introduire ensuite une vraie session ;
6. connecter enfin la logique aux vrais comptes.

## 16. Resume executif

Le serveur devra faire quatre choses :

1. reconnaitre l'etat utilisateur ;
2. choisir la bonne sidebar ;
3. autoriser ou refuser la page ;
4. preparer la future logique de session, de role et de droits.

La bonne base de depart est :
- pages publiques : `Accueil`, `Compte`
- pages privees : tout le reste
- navigation determinee cote serveur, pas seulement cote interface.
