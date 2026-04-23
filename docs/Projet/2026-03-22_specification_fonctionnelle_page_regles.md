# Specification fonctionnelle - page Règles

Date : 2026-03-22

## 1. Objet

Ce document décrit la future page `Règles` comme composant fonctionnel central du produit.

La page `Règles` doit devenir :
- une source métier explicite ;
- une source de contexte pour l'IA ;
- une base de gouvernance avant ouverture vers des sources complémentaires.

## 2. Rôle de la page

La page `Règles` ne doit plus être seulement une page de présentation.
Elle doit permettre de :
- créer ;
- modifier ;
- activer ;
- désactiver ;
- organiser ;
- transmettre des règles au système.

## 3. Rôle dans le traitement des mails

La page `Règles` intervient avant la génération de réponse IA.

Son rôle est de fournir :
- des consignes générales ;
- des garde-fous ;
- des règles métier ;
- des consignes de prudence ;
- des consignes sur les informations manquantes ;
- plus tard, des règles d'accès à des sources complémentaires.

## 4. Première version recommandée

La première version doit rester textuelle.

Elle doit permettre de saisir des règles en clair, sans accès externe automatisé.

## 5. Gouvernance et droits d'accès

Le principe retenu à ce stade est le suivant :
- seul l'administrateur peut créer, modifier, activer, désactiver, supprimer ou réorganiser les règles ;
- l'utilisateur standard ne modifie pas directement les règles ;
- l'utilisateur standard peut rejeter une réponse IA et expliquer pourquoi ;
- ce rejet peut inclure :
  - une raison métier ;
  - une proposition de règle à ajouter ;
  - une proposition de règle à compléter ;
  - une proposition de règle à corriger.

Conséquence fonctionnelle :
- la page `Règles` est d'abord une page d'administration ;
- côté utilisateur, le besoin principal n'est pas l'édition des règles, mais la remontée structurée d'un désaccord ou d'un manque de pertinence ;
- les suggestions utilisateur doivent nourrir une boucle d'amélioration continue pilotée par l'administrateur.

## 6. Utilisateurs concernés

Dans la première version :
- administrateur : accès complet ;
- utilisateur standard : pas d'édition directe ;
- gestionnaire métier : option future si le projet choisit d'ouvrir une délégation encadrée.

## 7. Types de règles à supporter

### Type 1 - Règle de contenu

But :
- fournir une information directement exploitable.

Exemple :
- "Pour les demandes administratives, répondre avec un ton professionnel et concis."

### Type 2 - Règle de prudence

But :
- empêcher une réponse trop rapide ou risquée.

Exemple :
- "Ne jamais confirmer un rendez-vous sans disponibilité connue."

### Type 3 - Règle de validation

But :
- préciser quand une validation humaine est obligatoire.

Exemple :
- "Toute confirmation de créneau doit être relue avant envoi."

### Type 4 - Règle de gestion d'information manquante

But :
- définir quoi faire si le contexte n'est pas suffisant.

Exemple :
- "Si une disponibilité manque, produire une réponse d'attente."

### Type 5 - Règle d'accès à source

But :
- préparer l'avenir en indiquant qu'une source externe autorisée devra être consultée.

Exemple :
- "Pour les rendez-vous, consulter le calendrier autorisé avant réponse définitive."

## 8. Portées de règles à prévoir

### Portée globale

Valable pour toute l'application.

### Portée boîte mail

Valable pour une boîte mail donnée.

### Portée catégorie

Valable pour une catégorie de mails.

### Portée workflow

Valable pour création, réponse, validation ou traitement automatique.

## 9. Champs fonctionnels recommandés

Chaque règle doit contenir au minimum :
- identifiant ;
- titre ;
- type ;
- portée ;
- thème ;
- contenu ;
- action attendue si information manquante ;
- niveau de priorité ;
- statut actif / inactif ;
- date de mise à jour ;
- auteur ou modificateur.

## 10. Thèmes recommandés

Exemples de thèmes :
- rendez-vous ;
- disponibilité ;
- administratif ;
- facture ;
- document ;
- ton ;
- validation ;
- prudence ;
- pièces jointes ;
- source externe.

## 11. Actions recommandées si l'information manque

Valeurs utiles à prévoir :
- répondre prudemment ;
- demander un complément ;
- bloquer la réponse finale ;
- signaler qu'une source externe est requise ;
- demander validation humaine.

## 12. Interface recommandée

La première version de la page d'administration doit comporter :

### Bloc 1 - Liste des règles

Affichage :
- titre ;
- type ;
- portée ;
- thème ;
- statut ;
- dernière mise à jour.

### Bloc 2 - Formulaire de création / modification

Champs :
- titre
- type
- portée
- thème
- contenu
- action si information manquante
- statut actif / inactif

### Bloc 3 - Aide de compréhension

Texte explicatif :
- les règles servent de source de contexte ;
- elles seront transmises à l'IA ;
- elles servent aussi à empêcher des réponses incorrectes.

### Bloc 4 - Gouvernance

Affichage recommandé :
- rappel que seules les personnes autorisées peuvent modifier les règles ;
- rappel que les utilisateurs standards enrichissent le système via les rejets commentés ;
- compteur de suggestions en attente ;
- lien ou accès vers la liste des suggestions issues des rejets.

### Bloc 5 - Suggestions issues des rejets utilisateur

Affichage recommandé :
- date ;
- utilisateur ;
- mail concerné ;
- réponse IA rejetée ;
- motif du rejet ;
- suggestion de règle ;
- statut de traitement :
  - à revoir ;
  - retenue ;
  - rejetée ;
  - transformée en règle.

## 13. Règles prioritaires à saisir en premier

Je recommande de commencer par quelques règles très simples :

1. "Ne jamais confirmer un rendez-vous sans disponibilité connue."
2. "Si une information nécessaire manque, produire une réponse prudente."
3. "Pour les pièces jointes, utiliser d'abord le contenu traité par l'application."
4. "Ne jamais inventer une information absente du contexte."
5. "En cas de doute, demander un complément ou validation humaine."

## 14. Intégration fonctionnelle avec l'IA

Les règles actives devront être injectées dans le contexte de génération.

L'IA devra être explicitement informée que :
- les règles sont une source obligatoire ;
- elles complètent le mail reçu ;
- elles doivent être utilisées avant toute réponse finale.

L'IA devra aussi être guidée pour :
- interpréter la teneur du mail ;
- décider si le contexte transmis suffit ;
- décider si les règles doivent être mobilisées ;
- signaler qu'une réponse exacte n'est pas possible si ni le mail, ni les pièces jointes, ni les règles ne suffisent.

La logique attendue est :
1. lire et comprendre la demande ;
2. évaluer la clarté et la suffisance du contexte ;
3. mobiliser les règles pertinentes si besoin ;
4. répondre précisément si possible ;
5. sinon produire une réponse prudente ou demander un complément.

## 15. Intégration future avec les sources complémentaires

Dans la première version :
- la règle contient la donnée ou la consigne en clair.

Plus tard :
- certaines règles indiqueront qu'il faut accéder à :
  - un calendrier ;
  - un fichier ;
  - un site web ;
  - une autre source autorisée.

Exemple :
- au lieu d'écrire en dur les horaires d'un club de tennis ;
- la règle indiquera qu'il faut consulter la source calendrier ou le référentiel d'horaires autorisé.

## 16. Distinction fondamentale à préserver

La page `Règles` devra toujours permettre de distinguer :

### Cas A

La donnée est directement écrite dans la règle.

### Cas B

La règle n'apporte pas la donnée, mais dit où et comment la chercher.

Cette distinction est essentielle pour la suite de l'architecture.

## 17. Critères d'acceptation de la première version

La première version de la page `Règles` sera considérée utile si :
- il est possible de créer une règle textuelle ;
- il est possible d'activer ou désactiver une règle ;
- les règles actives sont distinguées des règles inactives ;
- les règles sont exploitables par le backend ;
- elles peuvent être transmises au prompt de réponse.

Critères complémentaires de gouvernance :
- l'utilisateur standard ne peut pas modifier directement une règle ;
- l'administrateur peut traiter les suggestions issues des rejets utilisateur ;
- un rejet utilisateur peut être relié à une amélioration potentielle du référentiel de règles.

Critère complémentaire de qualité :
- le système doit favoriser les règles générales, répétitives et utiles ;
- il ne doit pas encourager l'accumulation de règles pour des cas isolés, anecdotiques ou sans valeur représentative.

## 18. Conclusion

La page `Règles` est la prochaine vraie brique fonctionnelle après la saisie audio et le contrôle de complétude du contexte.

Elle est indispensable pour :
- améliorer la qualité des réponses ;
- éviter les erreurs ;
- préparer proprement l'ouverture future vers des sources externes.
