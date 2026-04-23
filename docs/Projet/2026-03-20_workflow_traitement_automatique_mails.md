# Workflow du traitement automatique des mails

## Objet

Définir le fonctionnement cible du traitement automatique des mails.

Ce document complète le traitement manuel et fixe les règles de passage automatique d'un mail au suivant.

## Principe général

Le traitement automatique n'effectue pas de tri physique de la liste.

Le système procède par passes successives sur les mails visibles à traiter.

Ordre des passes :
- `critique`
- `haute`
- `normale`
- `basse`

Dans chaque passe :
- les mails sont traités du plus ancien au plus récent

## Déclenchement

Le traitement automatique est lancé par une action explicite de l'utilisateur.

Forme recommandée :
- bouton `Lancer le traitement automatique`

Le traitement automatique est destiné à devenir le mode par défaut.

## Séquence de traitement

### 1. Calcul préalable

Avant le début de la campagne :
- le système lit la liste des mails à traiter
- calcule classification et priorité pour chaque mail
- prépare l'ordre des passes

### 2. Passe Critique

Le système :
- prend les mails de priorité `critique`
- du plus ancien au plus récent

Pour chaque mail :
1. ouvre le mail
2. affiche son contenu
3. vérifie si le contexte disponible est suffisant pour répondre
4. consulte aussi les règles métier disponibles
5. génère soit :
   - une réponse complète ;
   - une réponse prudente ;
   - ou une demande d'information complémentaire
6. présente la sortie à l'utilisateur
7. attend l'une des 3 décisions :
   - `Valider l’envoi`
   - `Rejeter`
   - `Supprimer`
8. le mail disparaît ensuite de la liste active
9. le système passe automatiquement au suivant

### 3. Passe Haute

Même logique que la passe critique, sur les mails `haute`.

### 4. Passe Normale

Même logique sur les mails `normale`.

### 5. Passe Basse

Même logique sur les mails `basse`.

### 6. Fin de campagne

Quand il n'y a plus de mail à traiter :
- la liste est vide
- la campagne automatique est terminée

## Rôle de l'utilisateur

Dans ce mode, l'utilisateur ne fait que :
- `Valider l’envoi`
- `Rejeter`
- `Supprimer`

Le système gère :
- l'ordre des passes
- la sélection du mail suivant
- le contrôle de complétude du contexte
- la consultation des règles disponibles
- la génération de la réponse ou d'une sortie prudente
- le passage automatique au mail suivant

## Gestion de la non-réponse utilisateur

## Problème visé

Si l'utilisateur ne répond pas ou répond trop tard :
- le flux ne doit pas se bloquer

## Règle

Chaque mail affiché dans le traitement automatique dispose d'un délai maximum de réponse utilisateur.

Si ce délai est dépassé :
- le système n'attend plus
- le mail n'est pas traité
- il change automatiquement de priorité
- le traitement continue sur les autres mails

## Escalade de priorité

Règle d'escalade :
- `basse` -> `normale`
- `normale` -> `haute`
- `haute` -> `critique`
- `critique` -> `alarme administrateur`

## Cas `critique`

Si un mail déjà `critique` n'est pas traité à cause de l'absence de réponse utilisateur :
- il ne peut pas monter plus haut dans la grille normale
- une alarme doit être envoyée à l'administrateur principal

Contenu minimal de l'alarme :
- identifiant du mail
- expéditeur
- objet
- date
- niveau de priorité
- motif : absence de décision utilisateur dans le délai imparti

## Effets de l'escalade

Un mail non traité dans le délai :
- reste dans le système
- n'est pas supprimé
- n'est pas envoyé
- change de priorité
- réintègre la file de traitement dans sa nouvelle priorité

## Modèle LLM pendant la campagne

Pour éviter des changements permanents et une comptabilité floue :
- un modèle principal est fixé au lancement de la campagne

Le modèle reste identique pendant toute la campagne, sauf décision explicite de redémarrer une nouvelle campagne.

## Comptabilité et traçabilité

Chaque traitement automatique devra tracer :
- le mail traité
- la priorité initiale
- la priorité finale si escalade
- le modèle LLM utilisé
- la date et l'heure
- le résultat :
  - validé
  - rejeté
  - supprimé
  - non traité par absence de réponse

Pour chaque génération LLM, conserver aussi :
- le nombre de générations
- le nombre de régénérations
- la durée
- le modèle
- l'éventuel fallback

## Sécurité de départ

Pour la première version :
- pas d'envoi automatique silencieux
- la décision finale reste humaine
- seule la progression dans la file est automatisée
- si le contexte est insuffisant, le système ne doit pas forcer une réponse définitive

## Résumé du fonctionnement

1. l'utilisateur lance le traitement automatique
2. le système calcule classification et priorité
3. il traite les mails par passes :
   - critique
   - haute
   - normale
   - basse
4. dans chaque passe :
   - du plus ancien au plus récent
5. l'utilisateur décide :
   - valider
   - rejeter
   - supprimer
6. si l'utilisateur ne répond pas à temps :
   - le mail change de priorité
   - ou déclenche une alarme admin s'il était déjà critique
7. le système continue jusqu'à épuisement de la liste
