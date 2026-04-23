# Reference de l'etat actuel de la dictee vocale semi-automatique

## Objet

Ce document fige l'etat de reference actuel de la dictee vocale avant toute evolution vers un mode plus automatique base sur detection de silence.

Nom de reference retenu :
- `Mode semi-automatique`

## Comportement actuel valide

Le module commun de dictee est :
- `frontend/js/audioInput.js`

Le principe actuel est le suivant :
- la dictee est lancee manuellement ;
- la transcription peut s'afficher progressivement selon le mode ;
- en mode `commande IA`, la commande vocale est interpretee puis appliquee seulement a l'arret de la dictee ;
- il faut donc aujourd'hui une action manuelle `Stop dictee` pour declencher effectivement l'application de la commande ;
- apres application, l'utilisateur doit relancer manuellement la dictee pour une nouvelle commande.

## Difference entre les modes

### Modes d'insertion directe

Pour :
- `Inserer au curseur`
- `Remplacer selection`
- `Ajouter a la fin`

le texte peut etre injecte progressivement pendant la dictee.

### Mode `Commande IA`

Pour :
- `Commande IA locale`

le comportement de reference est different :
- le texte reconnu est accumule pendant la dictee ;
- la commande n'est pas appliquee au fil de l'eau ;
- l'analyse et l'application se font a la fin de la dictee ;
- ce mode est donc semi-automatique et non temps reel.

## Justification fonctionnelle de l'etat actuel

Ce comportement evite :
- d'appliquer trop tot une commande incomplete ;
- de couper un ordre vocal encore en cours ;
- de provoquer des modifications successives instables pendant une seule phrase de commande.

Il constitue une base stable, mais il est juge trop lourd a l'usage si l'utilisateur doit relancer manuellement la dictee apres chaque commande.

## Evolution cible envisagee

Evolution envisagee sans rupture de logique metier :
- conserver la logique actuelle d'analyse de commande ;
- remplacer le `Stop dictee` manuel de validation par une validation automatique apres un delai de silence configurable ;
- bloquer temporairement toute nouvelle saisie vocale pendant la phase d'analyse puis d'application ;
- reouvrir automatiquement l'ecoute une fois l'application terminee ;
- garder un `Stop` manuel ou vocal pour fermer completement le processus.

## Parametre fonctionnel envisage

Parametre propose :
- `delai de fin de commande vocale`

Valeur initiale conseillee :
- `1,5 s` a `2 s`

## Signaux d'etat valides

Les etats visuels retenus pour la future evolution sont :

- `Vert` : en attente de saisie vocale, ecoute ouverte
- `Rouge` : en cours d'analyse
- `Orange` : en cours d'implementation de la commande

## Regle de maintenance

Avant toute evolution vers le mode plus automatique :
- conserver ce document comme reference fonctionnelle ;
- considerer le comportement actuel comme version de repli ;
- ne pas supprimer la logique semi-automatique tant que le nouveau mode n'est pas stabilise.
