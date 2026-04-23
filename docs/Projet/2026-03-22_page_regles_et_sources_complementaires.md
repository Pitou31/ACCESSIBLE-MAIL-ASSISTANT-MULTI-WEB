# Page Règles et sources complémentaires

Date : 2026-03-22

## 1. Objet

Ce document décrit le rôle cible de la page `Règles`.

Elle doit devenir la première brique de gouvernance du contexte avant réponse IA.

## 2. Rôle cible de la page

La page `Règles` ne doit pas seulement présenter des intentions.
Elle doit permettre de saisir et maintenir des informations structurées utiles à la réponse.

## 3. Premier niveau de mise en œuvre

Le premier niveau doit être textuel.

L'utilisateur ou l'administrateur peut saisir :
- règles générales de ton ;
- règles métier ;
- règles de validation ;
- règles de prudence ;
- réponses interdites ;
- consignes à suivre si une information manque.

## 4. Exemples de règles textuelles

Exemples :
- "Ne jamais confirmer un rendez-vous sans disponibilité connue."
- "Si l'information manque, proposer une réponse d'attente."
- "Pour un mail administratif, utiliser un ton professionnel et concis."
- "Si un justificatif est mentionné, vérifier d'abord les pièces jointes avant de répondre."

## 5. Deuxième niveau de mise en œuvre

Plus tard, certaines règles pourront pointer vers une source complémentaire.

Exemples :
- calendrier ;
- fichier ;
- site web ;
- dossier partagé ;
- base de connaissance.

## 6. Formes possibles de règles futures

### Forme A - Règle textuelle simple

Exemple :
- "Disponibilités habituelles : mardi matin uniquement."

### Forme B - Règle d'accès à une source

Exemple :
- "Règle calendrier : pour tout rendez-vous, consulter la source calendrier autorisée avant de répondre."

## 7. Différence essentielle

Dans le premier cas :
- on donne à l'IA la donnée elle-même.

Dans le second cas :
- on ne lui donne pas la donnée finale ;
- on lui donne une autorisation et une méthode pour aller la chercher.

## 8. Conséquence fonctionnelle

Cela signifie que le système devra savoir gérer deux situations :

### Situation 1

L'information est déjà dans les règles.

Alors l'IA peut l'utiliser directement.

### Situation 2

Les règles indiquent qu'il faut consulter une autre source.

Alors l'IA seule ne suffit plus.
Le système doit pouvoir :
- détecter ce besoin ;
- déclencher l'accès autorisé ;
- récupérer ou faire récupérer l'information ;
- réinjecter le résultat dans le contexte.

## 9. Recommandation de mise en œuvre progressive

### Étape 1

Commencer par des règles purement textuelles.

### Étape 2

Introduire une structuration simple des règles :
- type ;
- portée ;
- thème ;
- niveau de priorité ;
- action attendue si information manquante.

### Étape 3

Introduire plus tard des règles d'accès à source externe.

## 10. Champs recommandés pour une future saisie de règle

Pour chaque règle :
- titre ;
- type de règle ;
- portée ;
- contenu ;
- action si information manquante ;
- source externe éventuelle ;
- statut actif/inactif.

## 11. Types de règles recommandés

- règle de contenu ;
- règle de prudence ;
- règle de validation ;
- règle d'accès à source ;
- règle d'escalade.

## 12. Conclusion

La page `Règles` doit d'abord devenir :
- la base de connaissances textuelle du produit ;
- puis la base de gouvernance des accès à des sources complémentaires.
