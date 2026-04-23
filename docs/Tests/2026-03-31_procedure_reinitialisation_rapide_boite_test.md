# Procédure rapide de remise à zéro de la boîte de test

Date : 2026-03-31
Projet : ACCESSIBLE_MAIL_ASSISTANT_MULTI

## Objectif
Remettre rapidement les mails de test dans l'état initial de début de campagne afin de pouvoir rejouer les scénarios fonctionnels autant de fois que nécessaire.

## Commande la plus simple
Depuis la racine du projet :

```bash
cd /Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI
bash ./reset-test-mails.sh
```

Cette commande utilise par défaut la boîte de test :
- `testagentmail.js@gmail.com`

## Variante avec une autre boîte
```bash
cd /Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI
bash ./reset-test-mails.sh votre-boite-test@gmail.com
```

## Variante sans réinjection immédiate
```bash
cd /Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI
bash ./reset-test-mails.sh testagentmail.js@gmail.com --no-reinject
```

## Variante npm courte
```bash
cd /Users/jacquessoule/Documents/SPARK/ACCESSIBLE_MAIL_ASSISTANT_MULTI
npm run reset:test-mailbox:quick
```

## Quand l'utiliser
À chaque fois que l'on veut repartir d'un état initial propre avant une série de tests, par exemple pour tester :
- `Valider`
- `Rejeter`
- `Supprimer`
- les priorités
- la génération de réponse
- les traitements automatiques

## Rappel pratique
Après la réinitialisation :
1. recharger la page `Mails` ;
2. rafraîchir l'Inbox ;
3. vérifier que les mails de test sont revenus ;
4. relancer les scénarios.
