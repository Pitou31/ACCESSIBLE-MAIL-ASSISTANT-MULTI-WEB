# Specification de reprise - navigation, pages produit et gestion future des comptes

Date : 2026-03-15

## 1. Objet du document
Ce document recense les decisions prises, le travail realise et les orientations retenues pendant la session du 15 mars 2026.

Son objectif est double :
- ne pas perdre les decisions structurantes prises aujourd'hui ;
- permettre une reprise rapide du projet sans devoir reconstituer le raisonnement.

---

## 2. Etat du projet a l'issue de la session

### 2.1 Situation initiale constatee
Le projet presentait une confusion importante autour de la sidebar :
- une ancienne logique injectait la sidebar via JavaScript ;
- certains fichiers servaient du JavaScript a la place du HTML attendu ;
- le serveur pouvait etre lance depuis le mauvais dossier, ce qui servait une version incoherente des pages ;
- la gestion du theme et du bandeau etait partiellement dupliquee selon les pages.

### 2.2 Resultat obtenu
Le projet fonctionne de nouveau correctement en local sur :
- `/index.html`
- `/frontend/mail.html`

La structure actuelle repose sur :
- une sidebar commune definie une seule fois ;
- une injection cote serveur de cette sidebar dans les pages HTML ;
- une logique commune de navigation et de theme ;
- des pages produit reelles accessibles depuis la navigation laterale.

---

## 3. Travail realise aujourd'hui

### 3.1 Sidebar commune
La sidebar est maintenant definie dans :
- `frontend/components/sidebar.html`

Elle n'est plus geree separement page par page dans le code source actif.

### 3.2 Injection cote serveur
Le serveur injecte la sidebar commune dans les pages HTML avant envoi.

Principe retenu :
- les pages HTML contiennent le placeholder `<!-- SIDEBAR -->`
- le serveur remplace ce placeholder par le contenu de `frontend/components/sidebar.html`

### 3.3 Fiabilisation du serveur
Le serveur a ete fiabilise pour servir les bons fichiers du projet sans dependre du dossier depuis lequel il est lance.

Objectif :
- eviter les erreurs dues a `process.cwd()`
- garantir que le bon frontend est toujours servi

### 3.4 Nettoyage de structure
Les fichiers obsoletes ou trompeurs ont ete supprimes du frontend actif :
- anciennes variantes de pages mail
- anciennes variantes de scripts
- fichiers parasites inutiles pour la maintenance courante

### 3.5 Navigation produit reelle
La sidebar pointe maintenant vers de vraies pages cibles :
- Accueil
- Compte
- Mails
- Parametres
- Regles
- Statistiques
- Versions
- Sauvegardes

### 3.6 Pages actuellement creees
Pages en place a ce stade :
- `frontend/index.html`
- `frontend/account.html`
- `frontend/mail.html`
- `frontend/settings.html`
- `frontend/rules.html`
- `frontend/stats.html`
- `frontend/versions.html`
- `frontend/backups.html`

Ces pages ne sont pas encore toutes fonctionnelles metier, mais elles constituent la structure produit de reference.

### 3.7 Sauvegardes effectuees avant nettoyage
Deux sauvegardes horodatees ont ete creees avant nettoyage :
- sauvegarde interne projet
- sauvegarde externe dans `Documents/sauvegarde-assistant-mail`

Intitule utilise :
- `Sauvegrde avant nettoyage`

---

## 4. Decision importante concernant les comptes

### 4.1 Decision de priorite
La gestion complete des comptes ne sera pas implementee tout de suite.

Priorite retenue :
- faire d'abord fonctionner correctement le produit en local ;
- concevoir des maintenant l'architecture fonctionnelle des comptes ;
- documenter cette architecture pour la reprendre plus tard sans perte.

Cette decision est importante :
- on n'ouvre pas encore le chantier technique complet de l'authentification ;
- on fixe en revanche clairement la cible produit.

---

## 5. Vision retenue pour la gestion des comptes

### 5.1 Deux types de comptes
Deux grands types de comptes sont retenus :

#### A. Compte administrateur
- donne tous les droits ;
- gere les validations d'ouverture de compte ;
- gere les droits et les affectations ;
- gere la partie administrative et comptable ;
- doit etre cree et protege hors du parcours utilisateur standard ;
- ne doit pas etre accessible par le formulaire public de demande d'ouverture de compte.

#### B. Compte utilisateur
- cree apres validation par l'administrateur ;
- dispose de droits limites ;
- accede uniquement aux fonctions autorisees ;
- est rattache a une ou plusieurs boites mail selon son profil.

### 5.2 Principe fondamental
Le systeme ne doit pas etre pense uniquement autour des comptes.

Il doit etre pense autour de trois objets :
- le compte ;
- le role ;
- la boite mail suivie.

Conclusion :
les droits d'un utilisateur dependront a la fois :
- de son role ;
- des boites mail auxquelles il est rattache ;
- du niveau d'autorisation accorde sur chacune de ces boites.

---

## 6. Fonctionnement propose pour l'ouverture de compte utilisateur

### 6.1 Parcours propose
1. Un visiteur accede a une page de demande d'ouverture de compte.
2. Il remplit un formulaire de candidature.
3. La demande est enregistree avec un statut `en attente`.
4. L'administrateur consulte les demandes recues.
5. L'administrateur peut :
   - accepter ;
   - refuser ;
   - demander des precisions complementaires.
6. En cas d'acceptation :
   - le compte utilisateur est cree automatiquement ;
   - les informations du formulaire servent de base au compte ;
   - un statut actif est attribue ;
   - des droits par defaut sont affectes ;
   - une ou plusieurs boites mail peuvent etre rattachees.

### 6.2 Avantage de cette approche
- controle humain conserve au demarrage ;
- creation des comptes non librement ouverte ;
- meilleure maitrise des acces ;
- processus evolutif vers un vrai circuit d'habilitation.

---

## 7. Consequence structurante pour la gestion des mails

### 7.1 Multi-utilisateur sur une meme boite mail
La vision retenue admet qu'une meme boite mail puisse etre suivie par plusieurs utilisateurs.

Cela implique :
- un suivi par adresse de boite mail ;
- une notion d'affectation utilisateur <-> boite mail ;
- une journalisation des actions par utilisateur ;
- une gestion plus fine des droits.

### 7.2 Impact produit
Le projet n'est donc pas seulement un outil de traitement de mails individuels.
Il peut devenir une plateforme d'assistance mail partagee, avec :
- utilisateurs finaux ;
- aidants ;
- administrateur ;
- eventuellement futurs profils professionnels ou organisationnels.

---

## 8. Modele fonctionnel recommande pour la suite

### 8.1 Entites a prevoir
Entites recommandees :
- `account_requests`
- `users`
- `roles`
- `mailboxes`
- `mailbox_members`
- `mail_actions`

### 8.2 Role de chaque entite

#### `account_requests`
Contient les demandes d'ouverture de compte :
- identite du demandeur ;
- contact ;
- motivation / contexte ;
- statut ;
- commentaires administrateur.

#### `users`
Contient les comptes effectivement crees :
- profil ;
- role ;
- statut ;
- informations de contact ;
- donnees de suivi.

#### `roles`
Contient les profils d'acces :
- administrateur ;
- utilisateur standard ;
- utilisateur validateur ;
- eventuellement aidant ou autre plus tard.

#### `mailboxes`
Represente les boites mail suivies par le produit.

#### `mailbox_members`
Associe les utilisateurs aux boites mail avec un niveau de droit.

#### `mail_actions`
Journalise les actions sur les mails :
- lecture ;
- analyse ;
- generation de brouillon ;
- validation ;
- rejet ;
- envoi.

---

## 9. Repartition recommandees des ecrans

### 9.1 Page Compte
La page `Compte` doit devenir l'espace utilisateur personnel.

Elle pourra a terme contenir :
- profil ;
- etat du compte ;
- statistiques personnelles ;
- boites mail autorisees ;
- niveau de droits visible.

### 9.2 Future page Administration
Il est recommande de ne pas tout mettre dans `Compte`.

Une future page `Administration` devrait etre creee pour l'administrateur uniquement, avec :
- demandes d'ouverture ;
- validation / refus ;
- creation de comptes ;
- gestion des droits ;
- affectation aux boites mail ;
- supervision globale ;
- comptabilite / abonnements si besoin.

Conclusion :
- `Compte` = espace utilisateur ;
- `Administration` = espace reserve administrateur.

---

## 10. Ordre d'implementation recommande

Ordre conseille pour la suite :

1. Stabiliser totalement le produit local actuel.
2. Verifier les pages produit et la navigation commune.
3. Formaliser le modele de donnees des comptes.
4. Ajouter une page publique de demande d'ouverture de compte.
5. Mettre en place un compte administrateur protege.
6. Ajouter l'interface de validation des demandes.
7. Automatiser la creation du compte utilisateur apres acceptation.
8. Associer les utilisateurs aux boites mail.
9. Journaliser les actions utilisateur sur les mails.

Cet ordre permet d'avancer sans casser le socle UI deja remis d'aplomb.

---

## 11. Points d'attention

### 11.1 Securite
- le compte administrateur doit etre protege hors du parcours public ;
- les roles et droits doivent etre explicites ;
- la gestion des boites mail doit etre stricte.

### 11.2 Traçabilite
Le suivi des actions doit etre pense des le depart si plusieurs utilisateurs partagent une meme boite mail.

### 11.3 Architecture
Le produit devra distinguer clairement :
- logique d'interface ;
- logique de comptes ;
- logique de droits ;
- logique de boites mail ;
- logique IA et automatisation.

---

## 12. Resume court pour reprise ulterieure

Si ce document doit etre relu rapidement plus tard, retenir ceci :

- la sidebar et la navigation commune ont ete restructurees et stabilisees ;
- le projet dispose maintenant de plusieurs pages produit reelles ;
- la gestion complete des comptes est reportee a une etape ulterieure ;
- deux types de comptes sont retenus : administrateur et utilisateur ;
- l'ouverture de compte utilisateur passera par une demande soumise a validation ;
- le systeme doit etre pense avec une logique multi-utilisateur et multi-boite mail ;
- une future page `Administration` sera preferable a une surcharge de la page `Compte` ;
- la prochaine grande etape logique sera de formaliser puis d'implementer ce modele sans casser le fonctionnement local actuel.
