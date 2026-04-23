# Backlog fonctions et priorités

Date : 2026-03-31
Projet : ACCESSIBLE_MAIL_ASSISTANT_MULTI

## Règle de pilotage
Priorités retenues :
1. Finir un premier agent de production.
2. Ajouter ensuite les fonctions utiles.

Le projet vise un public large, avec une priorité forte pour les personnes handicapées et les usages nécessitant simplicité, guidage, vérifications automatiques et réduction du risque d'erreur.

## Décisions et clarifications retenues

### 1. Résumé du mail reçu
A implémenter sous forme de popup à la demande via un bouton `Résumé`, principalement pour le mode `Répondre au mail`.

Deux vues distinctes sont prévues.

#### 1.a Résumé pour l'usager
Résumé en langage simple, en 3 lignes maximum :
- ce qu'on te demande
- ce qu'il faut faire
- s'il y a une urgence
- s'il existe des règles applicables à ce cas

#### 1.b Résumé pour l'administrateur
Vue orientée pilotage et amélioration du système :
- règles manquantes
- règles insuffisantes
- zones d'ambiguïté
- points non automatisables
- demandes de précision recommandées

### 2. Alertes automatiques sur les demandes insuffisantes
Fonction jugée très intéressante et prioritaire après stabilisation du premier agent de production.

Objectif : aider à détecter automatiquement qu'un mail reçu est insuffisant pour répondre correctement.

Exemples :
- information manquante
- demande ambiguë
- règle absente
- règle insuffisante
- cas non automatisable
- besoin de demander une précision à l'émetteur
- besoin de mise en attente avec priorité

Cette fonction devra préciser à quel moment les alertes apparaissent :
- à réception du mail
- à l'ouverture du mail
- pendant la préparation de la réponse
- avant l'envoi

### 3. Contrôle de lisibilité et accessibilité du mail généré
Fonction conservée.

Utilité attendue :
- simplifier le texte pour des usagers avec difficultés cognitives, de lecture ou de compréhension
- détecter phrases trop longues
- détecter ton trop complexe
- détecter vocabulaire trop abstrait
- proposer une version simple ou très simple

### 4. Vérification avant envoi
Fonction conservée uniquement si elle est automatique et propose des suggestions concrètes.

Exemples :
- question non traitée
- pièce jointe mentionnée mais absente
- date ou action oubliée
- règle non prise en compte
- destinataire manquant
- incohérence de langue

### 5. État visuel du système
Point déjà partiellement présent.
Ne pas dupliquer inutilement ce qui existe déjà.

Déjà présents ou amorcés :
- langue détectée
- mode de lecture actif
- voix active
- modèle actif

A surveiller seulement s'il manque un état réellement utile, par exemple :
- brouillon généré / non généré
- pièce jointe prise en compte / non prise en compte

### 6. Mode guidé pas à pas
Fonction très intéressante.

Vision retenue :
- l'IA fait une préanalyse du mail reçu
- elle identifie ce qui manque pour comprendre et répondre correctement
- elle aide à savoir s'il existe des règles applicables
- elle aide à savoir s'il faut créer une règle
- elle aide à savoir s'il faut demander automatiquement des précisions
- elle aide à savoir s'il faut mettre le mail en attente ou le prioriser

### 7. Intentions de réponse prêtes
A réévaluer plus tard.

Intérêt potentiel :
- accélérer les cas standards
- proposer des squelettes de réponse adaptés à l'intention réelle
- réduire l'effort de formulation

Exemples :
- accepter
- refuser
- demander une précision
- accuser réception
- relancer
- proposer un rendez-vous

À ne conserver que si cela simplifie réellement l'usage.

### 8. Historique des versions
À clarifier plus tard.

Question ouverte :
- parle-t-on de versions de brouillons produits à la demande
- ou d'un historique système plus large

Hypothèse la plus utile :
- historique des brouillons et variantes de réponse
- comparaison avant/après
- retour à une version précédente

### 9. Lecture segmentée avec surlignage visuel
Existe déjà, même si ce n'est pas parfait.
Ne pas prioriser maintenant.

### 10. Gestion intelligente des pièces jointes
Fonction à conserver avec deux priorités principales.

#### 10.a Vérifier la prise en compte réelle des pièces jointes entrantes
- détecter automatiquement qu'une pièce jointe existe
- vérifier qu'elle a bien été intégrée dans le traitement IA
- rassurer l'usager sur le fait qu'elle est bien prise en compte

#### 10.b Vérifier la présence de la pièce jointe attendue en sortie
- si l'opérateur mentionne une pièce jointe dans la réponse, vérifier qu'elle est réellement jointe
- si la réponse nécessite une pièce jointe, alerter si elle manque

### 11. Profils d'accessibilité
À rapprocher des paramètres existants.

Pistes :
- moteur simple
- moteur très guidé
- lecture lente
- fort contraste
- texte simplifié
- confirmations renforcées

### 12. Détection d'ambiguïté
Fonction jugée intéressante si elle est automatique.

Exemples :
- la demande n'est pas claire
- il manque une information
- plusieurs interprétations sont possibles

### 13. Mode anti-erreur
Fonction conservée.

Exemples :
- champ vide
- destinataire manquant
- pièce annoncée absente
- langue incohérente
- pièce jointe nécessaire absente
- action promise sans information suffisante

### 14. Réponses ultra-courtes prêtes à valider
Fonction conservée comme paramètre de sortie.

Formats envisagés :
- une phrase
- trois phrases
- version développée

### 15. Mémoire par correspondant
Fonction intéressante mais à cadrer plus tard.

Pistes :
- ton habituel
- langue habituelle
- formule préférée
- niveau de formalité

## Oublis à intégrer explicitement au plan

### A. Statistiques
Prévoir un plan séparé avec :
1. statistiques globales
2. statistiques détaillées

### B. Tests audio
Prévoir un plan explicite des tests audio restants et de leur validation.

### C. Sauvegardes
Prévoir un plan explicite de gestion, validation et rotation des sauvegardes.

### D. Accès à différentes boîtes mails
Prévoir l'extension à d'autres boîtes, notamment Outlook.

## Priorités fonctionnelles retenues maintenant

### Priorité 1 : finir un premier agent de production
Avant d'ajouter beaucoup de fonctions, il faut stabiliser :
- le flux mail
- les règles
- les tests
- l'accessibilité réelle
- la lecture audio
- la robustesse des sauvegardes

### Priorité 2 : ajouter les fonctions à plus forte valeur
Parmi les fonctions à plus forte valeur après stabilisation :
1. plans sur ce qui manque dans les fonctions prévues dans la sidebar
2. détection automatique des mails insuffisants
3. détection de ce qui manque pour répondre
4. détection de ce qui manque en règles
5. détection de ce qui n'est pas automatisable
6. proposition automatique de demande de précisions

## Sujet jugé particulièrement intéressant
Sujet à forte valeur ajoutée à travailler après stabilisation :

Comment l'IA peut aider à repérer automatiquement :
- qu'un mail est insuffisant pour répondre correctement
- ce qu'il manque
- quelles règles seraient utiles
- quelles règles sont absentes ou insuffisantes
- ce qui n'est pas automatisable
- quand il faut demander automatiquement des précisions à l'émetteur

## Règle de suivi
Ce document sert de référence de backlog.
À chaque résolution d'un point important :
- le point doit être marqué comme traité
- les priorités doivent être rappelées
- les éléments redondants ou déjà existants doivent être évités
