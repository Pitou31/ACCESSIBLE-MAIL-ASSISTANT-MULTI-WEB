# Jeu d'essai Gmail

Ce dossier contient un premier jeu d'essai de mails réalistes pour tester :

- la lecture,
- la réponse assistée,
- la création,
- les pièces jointes,
- les changements de LLM,
- la relecture audio.

Important :

- les champs `catégorie` et `priorité` ne sont pas fournis ici ;
- ils devront être produits au moment de l'analyse du mail par l'IA ;
- ce jeu est conçu pour une boîte Gmail de test, pas pour la production.

Fichiers :

- `mails-test.json` : lot principal de 10 mails de test
- `pieces-jointes/` : contenus fictifs des pièces jointes de test

## Réinitialisation et injection

Le projet `MULTI` contient deux scripts prêts à l'emploi :

- `npm run send:test-gmail-dataset`
- `npm run reset:test-gmail-mailbox`

Chemin du projet :

```bash
cd /Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI
```

### 1. Vérification sans envoi

```bash
npm run send:test-gmail-dataset -- --to votre-boite-test@gmail.com --dry-run
```

### 2. Injection simple du jeu d'essai

```bash
npm run send:test-gmail-dataset -- --to votre-boite-test@gmail.com
```

### 3. Réinitialisation complète de la boîte de test

Cette commande :

- vide les messages et brouillons de la boîte Gmail de test ;
- supprime les labels techniques `AMA_*` ;
- réinjecte ensuite automatiquement le jeu de 10 mails ;
- conserve les pièces jointes prévues par le corpus.

```bash
npm run reset:test-gmail-mailbox -- --email votre-boite-test@gmail.com
```

### 4. Nettoyage sans réinjection

```bash
npm run reset:test-gmail-mailbox -- --email votre-boite-test@gmail.com --no-reinject
```

### 5. Exemple utilisé pour nos tests

```bash
npm run reset:test-gmail-mailbox -- --email testagentmail.js@gmail.com
```

Le script d'injection :

- envoie les 10 mails du jeu d'essai ;
- utilise les pièces jointes réelles du dossier `pieces-jointes/` ;
- ajoute des en-têtes de test ;
- place l'adresse d'origine dans `Reply-To`.

Contenus fournis dans `pieces-jointes/` :

- `facture_test_contenu.md`
- `justificatif_handicap_contenu.md`
- `courrier_administratif_contenu.md`
- `photo_document_description.md`

## Spécification du corpus

Le corpus de référence est :

- `mails-test.json` : 10 mails de test
- `pieces-jointes/` : 4 pièces jointes réelles ou représentatives

Objectif du corpus :

- tester la lecture Inbox ;
- tester le traitement manuel ;
- tester le traitement automatique ;
- tester les réponses IA ;
- tester la détection et l'exploitation des pièces jointes ;
- tester la logique de verrouillage `occupé / libre` en mode multi.

Le script de réinitialisation à conserver en priorité est :

```bash
/Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI/backend/scripts/reset-gmail-test-mailbox.js
```

Le script d'injection simple est :

```bash
/Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI/backend/scripts/send-gmail-test-dataset.js
```
