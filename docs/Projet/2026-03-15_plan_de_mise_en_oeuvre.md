# Plan de mise en oeuvre - stabilisation locale puis evolution du produit

Date : 2026-03-15

## 1. Objet du document
Ce document transforme les decisions de specification en plan d'action concret.

Il a pour but :
- de definir un ordre de travail raisonnable ;
- de prioriser la stabilisation du produit local ;
- de repousser au bon moment la gestion complete des comptes ;
- de permettre une reprise simple du chantier.

---

## 2. Principe de pilotage retenu

Le projet doit avancer par couches :

1. stabiliser le socle local ;
2. consolider l'interface et la navigation ;
3. rendre les pages actuelles utiles ;
4. preparer les donnees et l'architecture ;
5. seulement ensuite ouvrir le chantier comptes / droits / administration.

Ce principe evite de construire des fonctions d'authentification ou de gestion complexe sur un socle encore trop mouvant.

---

## 3. Vue d'ensemble du plan

### Phase 1
Stabilisation locale du produit actuel

### Phase 2
Consolidation des pages et des parcours existants

### Phase 3
Preparation technique du futur systeme comptes / boites mail

### Phase 4
Mise en place du circuit de demande d'ouverture de compte

### Phase 5
Espace administration, droits et supervision

### Phase 6
Multi-utilisateur et suivi par boite mail

---

## 4. Phase 1 - Stabilisation locale

### Objectif
Disposer d'un produit local stable, reproductible et compréhensible.

### Priorites
- verifier que toutes les pages accessibles aujourd'hui se chargent correctement ;
- confirmer le bon fonctionnement de la sidebar commune ;
- verifier la persistance et le changement des themes ;
- stabiliser les chemins de navigation ;
- s'assurer que le serveur sert toujours le bon projet ;
- garder une structure claire du frontend et du backend.

### Livrables attendus
- application locale navigable ;
- zero confusion sur le dossier de lancement ;
- documentation de reprise deja produite ;
- sauvegardes internes et externes existantes.

### Etat au 15 mars 2026
Cette phase est bien avancee, mais doit encore etre confirmee par des tests de parcours manuels simples.

---

## 5. Phase 2 - Consolidation des pages produit

### Objectif
Transformer les pages actuelles en base produit utilisable, meme si certaines fonctions restent encore statiques.

### Pages concernees
- `index.html`
- `account.html`
- `mail.html`
- `settings.html`
- `rules.html`
- `stats.html`
- `versions.html`
- `backups.html`

### Priorites
- clarifier le role de chaque page ;
- eviter les chevauchements entre `Compte`, `Parametres` et `Statistiques` ;
- enrichir progressivement les pages les plus importantes ;
- garder le meme design et les memes themes.

### Sous-priorites recommandees
1. `mail.html`
2. `settings.html`
3. `rules.html`
4. `account.html`
5. `stats.html`
6. `backups.html`
7. `versions.html`

### Pourquoi cet ordre
- `mail.html` porte le coeur produit ;
- `settings.html` et `rules.html` prepareront les futures logiques de comportement ;
- `account.html` prendra du sens au moment ou les comptes arriveront ;
- `stats.html` sera plus utile quand les usages seront journalises.

---

## 6. Phase 3 - Preparation technique avant comptes

### Objectif
Preparer le terrain sans encore activer l'authentification complete.

### Travaux a faire
- definir les structures de donnees cibles ;
- choisir un stockage initial simple ;
- definir les objets `users`, `account_requests`, `mailboxes`, `mailbox_members`, `mail_actions` ;
- poser les statuts et les roles ;
- decider ou vivre la future logique d'administration dans le backend ;
- definir une convention de journalisation.

### Resultat attendu
Un socle de donnees pret, sans encore exposer de veritable inscription ou de gestion de compte aux utilisateurs.

---

## 7. Phase 4 - Demande d'ouverture de compte

### Objectif
Permettre a un utilisateur de postuler a l'usage du produit sans ouvrir immediatement les droits.

### Fonction cible
- page publique de demande d'ouverture ;
- formulaire complet ;
- enregistrement d'une demande ;
- statut `pending` ;
- possibilite ulterieure de demander des informations complementaires.

### A ne pas faire trop tot
- creation automatique de comptes sans validation ;
- acces admin non protege ;
- confusion entre formulaire de demande et page Compte.

### Resultat attendu
Un circuit propre de candidature a l'usage du produit.

---

## 8. Phase 5 - Administration

### Objectif
Permettre a l'administrateur de piloter les demandes, les comptes et les droits.

### Fonctions a prevoir
- consultation des demandes ;
- vue detaillee d'une demande ;
- approbation, refus, demande de precisions ;
- creation automatique de compte apres approbation ;
- attribution de role ;
- rattachement a une ou plusieurs boites mail ;
- suspension ou desactivation d'un compte ;
- supervision globale de l'activite.

### Rappel important
Le compte administrateur doit etre cree et protege hors du parcours public.

---

## 9. Phase 6 - Multi-utilisateur et boites mail partagees

### Objectif
Permettre a plusieurs utilisateurs de travailler sur une meme boite mail avec traçabilite.

### Capacites a prevoir
- rattacher plusieurs utilisateurs a une boite ;
- definir des droits par boite ;
- journaliser les actions par utilisateur ;
- distinguer lecture, brouillon, validation, envoi ;
- permettre un suivi par boite mail.

### Resultat attendu
Le produit devient une plateforme partagee, et plus seulement un assistant individuel.

---

## 10. Repartition recommandees des chantiers

### Chantier A - Interface
Concerne :
- sidebar ;
- pages ;
- parcours ;
- experience utilisateur ;
- themes.

### Chantier B - Metier
Concerne :
- regles ;
- categories ;
- logique de traitement des mails ;
- priorisation ;
- validations.

### Chantier C - Donnees et administration
Concerne :
- comptes ;
- demandes ;
- droits ;
- boites mail ;
- journalisation.

### Chantier D - Automatisation
Concerne :
- version 2 avec Browser Use ;
- version 3 automatisee ;
- orchestration avancee.

Cette repartition aidera a ne pas melanger les niveaux de complexite.

---

## 11. Ordre de travail recommande a court terme

Ordre conseille pour les prochaines sessions :

1. verifier toutes les pages produit nouvellement creees ;
2. consolider `mail.html` ;
3. enrichir `settings.html` et `rules.html` ;
4. continuer la documentation de structure ;
5. definir le stockage futur ;
6. seulement ensuite preparer la page publique de demande d'ouverture de compte.

---

## 12. Ce qu'il ne faut pas oublier

- les sauvegardes doivent continuer a etre faites avant les gros refactorings ;
- le projet doit garder une trace documentaire interne et externe ;
- la page `Compte` ne doit pas etre surchargee avec toute l'administration ;
- les boites mail doivent etre pensees comme des ressources partageables ;
- les versions 1, 2 et 3 du produit doivent rester lisibles dans l'architecture.

---

## 13. Resume executif

La suite du projet doit suivre une logique simple :

- d'abord, stabiliser et clarifier le produit local ;
- ensuite, rendre utiles les pages deja visibles ;
- puis preparer les donnees ;
- enfin, implementer la gestion des comptes, de l'administration et du multi-utilisateur.

Ce plan permet d'avancer avec methode, sans perdre ce qui a deja ete remis d'aplomb aujourd'hui.
