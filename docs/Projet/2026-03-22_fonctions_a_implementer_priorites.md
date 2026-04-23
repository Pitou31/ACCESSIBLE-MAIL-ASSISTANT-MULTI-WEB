# Fonctions à implémenter - ordre de priorité

Date : 2026-03-22

## 1. Objet

Ce document fixe l'ordre de priorité d'implémentation validé à ce stade.

## 2. Ordre de priorité retenu

### Priorité 1

Saisie audio.

### Priorité 2

Contrôle de complétude du contexte avant réponse IA.

### Priorité 3

Page `Règles` opérationnelle avec saisie de règles textuelles.

### Priorité 4

Accès futur à des sources complémentaires autorisées.

### Priorité 5

Automatisation navigateur avancée avec Browser Use.

## 3. Priorité 1 - Saisie audio

Fonctions minimales :
- activation/désactivation ;
- démarrage dictée ;
- pause ;
- reprise ;
- arrêt ;
- insertion dans une zone éditable ;
- statut visuel.

Zones prioritaires :
- `creationPrompt`
- `creationOutputMailContent`
- `replyOutputMailContent`

## 4. Priorité 2 - Complétude du contexte

Fonctions minimales :
- évaluer si le contexte suffit ;
- consulter les règles textuelles ;
- interdire l'invention ;
- produire soit :
  - réponse complète ;
  - réponse prudente ;
  - demande d'information.

## 5. Priorité 3 - Page Règles

Fonctions minimales :
- créer une règle ;
- modifier une règle ;
- activer / désactiver une règle ;
- transmettre les règles actives au backend ;
- les injecter dans le prompt.

## 6. Priorité 4 - Sources complémentaires

Fonctions futures :
- définir une règle d'accès ;
- autoriser une source ;
- préciser un chemin ou mode d'accès ;
- déclencher une récupération complémentaire.

## 7. Priorité 5 - Browser Use

Fonctions futures :
- navigation dans la boîte ;
- ouverture du bon mail ;
- scroll assisté ;
- injection de brouillon ;
- exploitation progressive de sources autorisées.

## 8. Conclusion

Le bon ordre n'est donc plus :
- Browser Use d'abord.

Le bon ordre devient :
- saisie audio ;
- puis fiabilisation de la qualité de réponse ;
- puis gouvernance des règles ;
- puis enrichissement du contexte ;
- puis automatisation navigateur plus poussée.
