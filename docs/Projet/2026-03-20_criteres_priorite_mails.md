# Critères de priorité des mails

## Objet

Définir une grille de priorité modulaire, réutilisable en traitement manuel et automatique.

## Principe

La priorité n'est pas déterminée par un seul mot-clé.

Elle est calculée par combinatoire à partir de plusieurs familles de critères.

## Familles de critères

### 1. Urgence explicite

Exemples :
- urgent
- urgence
- immédiat
- critique

### 2. Délai ou échéance

Exemples :
- aujourd'hui
- dès que possible
- avant le
- date limite
- échéance
- date détectée dans le message

### 3. Blocage ou incident

Exemples :
- bloqué
- impossible
- problème
- erreur
- incident
- panne

### 4. Impossibilité d'agir

Exemples :
- je ne peux pas
- je n'arrive pas
- je suis dans l'impossibilité

### 5. Relance

Exemples :
- relance
- sans réponse
- deuxième fois
- rappel

### 6. Critères métier sensibles

Exemples :
- réclamation
- contestation
- facture
- paiement
- remboursement

### 7. Demande d'information simple

Exemples :
- information
- renseignements
- précision

### 8. Contexte

Exemples :
- pièce jointe présente
- message long ou détaillé

## Combinatoire

La priorité finale doit tenir compte de la combinaison des familles actives.

Exemples :
- un seul signal faible ne suffit pas à rendre un mail critique
- plusieurs signaux forts cumulés doivent faire monter la priorité

Bonus prévus :
- au moins 2 familles actives
- au moins 3 familles actives

## Niveaux de priorité

- `Basse`
- `Normale`
- `Haute`
- `Critique`

## Exemples

### Exemple 1

Mail :
- simple demande d'information

Résultat attendu :
- `Normale`

### Exemple 2

Mail :
- relance
- pas de réponse précédente

Résultat attendu :
- `Haute`

### Exemple 3

Mail :
- urgent
- dossier bloqué
- réponse demandée aujourd'hui

Résultat attendu :
- `Critique`

### Exemple 4

Mail :
- simple remerciement

Résultat attendu :
- `Basse`

## Gouvernance

Les critères de priorité doivent être :
- stockés dans les paramètres
- modifiables par l'administrateur principal seulement

Les utilisateurs :
- font remonter leurs besoins
- proposent des ajustements par retour d'expérience

La décision et l'implémentation reviennent à l'administration principale.

## Coût IA

Pour commencer :
- pas d'IA dans le calcul de priorité

Le moteur prioritaire doit rester :
- explicable
- stable
- peu coûteux

L'IA pourra éventuellement être ajoutée plus tard :
- en arbitrage
- ou dans les cas ambigus
