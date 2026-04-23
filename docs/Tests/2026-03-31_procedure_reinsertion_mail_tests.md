# Procédure de réinsertion de mail pour les tests

Date : 2026-03-31
Projet : ACCESSIBLE_MAIL_ASSISTANT_MULTI

## Objet
Permettre de remettre en place un jeu de mails de test propre après des essais fonctionnels de création, réponse, validation, rejet ou suppression.

## Cas principal
Réinitialiser la boîte Gmail de test avec le script prévu dans le projet.

## Commande
Depuis la racine du projet :

```bash
cd /Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI
npm run reset:test-gmail-mailbox -- --email votre-boite-test@gmail.com
```

## Exemple déjà utilisé dans le projet
```bash
cd /Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI
npm run reset:test-gmail-mailbox -- --email testagentmail.js@gmail.com
```

## Effet attendu
- la boîte de test est remise dans un état connu ;
- les mails de test sont réinjectés ;
- les scénarios peuvent être rejoués proprement.

## Variante sans réinjection
Si l'on veut seulement nettoyer sans réinjecter immédiatement :

```bash
cd /Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI
npm run reset:test-gmail-mailbox -- --email votre-boite-test@gmail.com --no-reinject
```

## Recommandation pour les tests fonctionnels
Avant une campagne de tests :
1. réinitialiser la boîte de test ;
2. recharger l'Inbox dans l'application ;
3. rejouer les scénarios dans le même ordre ;
4. noter le comportement observé pour validation, rejet, suppression et priorité.

## Point spécifique sur le rejet
Le comportement attendu est désormais :
- `validated` : le mail sort de l'Inbox ;
- `deleted` : le mail sort de l'Inbox ;
- `rejected` : le mail reste dans l'Inbox et sa priorité augmente pour permettre un retraitement.
