# Gestion du jeu de test mails

## Objet

Ce document décrit :
- la sauvegarde du jeu de test mails
- sa restauration
- sa réinjection dans la boîte Gmail de test

## Principe

Le jeu de test initial ne dépend pas de l'état courant de la boîte Gmail.

Il est conservé dans le projet sous forme de source de référence.

Même si des mails sont traités, rejetés, supprimés ou déplacés dans Gmail, le jeu de test peut être recréé.

## Emplacement de référence

Jeu de test principal :
- `docs/Tests/jeu-essai-gmail/`

Contenu principal :
- `README.md`
- `mails-test.json`
- `pieces-jointes/`

Pièces jointes de référence :
- `facture_test.pdf`
- `justificatif_handicap.pdf`
- `courrier_administratif.docx`
- `photo_document.jpg`

## Ce qui est sauvegardé

Le corpus de référence contient :
- les 10 mails de test
- leurs objets
- leurs expéditeurs
- leurs contenus
- les références de pièces jointes
- les fichiers de pièces jointes

Ce corpus n'est pas modifié par les traitements Gmail de l'application.

## Ce qui peut changer dans Gmail

Dans la boîte Gmail de test, les mails peuvent :
- être sortis de l'Inbox
- être labellisés
- être déplacés en corbeille
- recevoir une réponse

Cela ne supprime pas le corpus source stocké dans le projet.

## Restauration du jeu de test

Pour restaurer le jeu de test dans la boîte Gmail de test, il suffit de réinjecter le corpus de référence.

Commande :

```bash
cd /Users/jacquessoule/Documents/ACCESSIBLE-MAIL-ASSISTANT
npm run send:test-gmail-dataset -- --to testagentmail.js@gmail.com
```

## Vérification sans envoi

Pour vérifier le corpus sans réinjecter :

```bash
cd /Users/jacquessoule/Documents/ACCESSIBLE-MAIL-ASSISTANT
npm run send:test-gmail-dataset -- --to testagentmail.js@gmail.com --dry-run
```

## Procédure recommandée de restauration

### Option simple

1. ouvrir la boîte Gmail de test
2. constater l'état courant
3. réinjecter le jeu de test
4. recharger l'Inbox dans Gmail
5. recharger l'Inbox dans l'application

### Option propre avant une nouvelle campagne de tests

1. vider ou nettoyer la boîte Gmail de test
2. réinjecter le jeu de test initial
3. reconnecter ou rafraîchir la boîte dans l'application
4. vérifier que les 10 mails de test sont visibles

## Règle de conservation

Le jeu de test initial doit toujours rester conservé dans :
- `docs/Tests/jeu-essai-gmail/`

Il ne faut pas :
- modifier directement le corpus de référence sans décision explicite
- remplacer les fichiers de test d'origine sans nouvelle sauvegarde documentaire

## Bonnes pratiques

- faire les essais sur la boîte Gmail de test et jamais sur la boîte de production
- vérifier après traitement les effets dans Gmail
- conserver le corpus source intact
- réinjecter un corpus propre avant une nouvelle série de tests

## Évolutions prévues

Le document sera complété plus tard avec :
- une procédure de nettoyage automatique de la boîte de test
- une procédure de restauration complète en un clic
- la gestion de plusieurs jeux de test
- la comparaison entre état initial et état après traitement
