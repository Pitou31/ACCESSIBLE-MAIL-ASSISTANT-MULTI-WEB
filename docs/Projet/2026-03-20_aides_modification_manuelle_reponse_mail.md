# Aides à la modification manuelle des réponses mail

## Objet

Ne pas oublier d'étudier plus tard les aides d'édition manuelle du texte dans la zone de réponse.

Ce document concerne les aides locales de saisie et de modification, distinctes des aides globales de réécriture de tout le texte.

## Besoin visé

Permettre à l'utilisateur de :
- modifier plus facilement un texte déjà généré
- intervenir localement sur une sélection ou à l'emplacement du curseur
- être aidé pendant la saisie

## Deux types de modification à distinguer

Il faut distinguer clairement :

### 1. Modification traditionnelle

Il s'agit d'une modification locale directe du texte par l'utilisateur.

Exemples :
- positionner le curseur dans le texte ;
- sélectionner un passage ;
- supprimer ;
- remplacer ;
- ajouter du texte ;
- utiliser la saisie audio au curseur au lieu du clavier.

Dans ce cas :
- l'utilisateur reste l'auteur direct de la modification ;
- l'application ne réécrit pas intelligemment le contenu ;
- la saisie audio remplace simplement un mode de saisie clavier.

### 2. Modification par IA

Il s'agit d'une transformation demandée à l'IA.

Exemples :
- "réécris ce passage"
- "raccourcis ce paragraphe"
- "reformule en ton plus chaleureux"
- "ajoute une précision sur la disponibilité mardi après-midi"

Dans ce cas :
- l'IA intervient comme moteur de transformation ;
- il ne s'agit plus d'une saisie directe ;
- cette famille de fonctions doit être traitée séparément.

Quand c'est possible, la demande de modification par IA pourra de préférence être formulée à l'oral plutôt qu'au clavier.

Exemples futurs :
- l'utilisateur sélectionne un passage ;
- puis dicte une consigne comme :
  - "réécris ce passage de manière plus simple"
  - "raccourcis ce paragraphe"
  - "mets un ton plus professionnel"

Dans ce cas :
- l'audio ne sert plus à insérer directement du texte ;
- il sert à exprimer une commande de transformation destinée à l'IA.

Point important :
- la saisie audio relève d'abord de la modification traditionnelle ;
- elle ne doit pas être confondue avec la réécriture assistée par IA.

## Fonctions à étudier plus tard

### Actions sur la sélection

- supprimer le texte sélectionné
- réécrire le texte sélectionné
- corriger le texte sélectionné
- raccourcir le texte sélectionné
- développer le texte sélectionné
- simplifier le texte sélectionné
- reformuler le texte sélectionné avec un ton différent

### Actions au curseur

- insérer du texte à partir du curseur
- insérer du texte dicté à partir du curseur
- compléter la phrase en cours
- proposer la suite du paragraphe
- ajouter une formule de politesse
- ajouter une conclusion
- ajouter un paragraphe explicatif

### Aides pendant la saisie

- affichage de mots probables
- affichage de suites de phrase probables
- proposition discrète de complétion
- validation rapide d'une suggestion par clavier

### Aides de correction locale

- orthographe
- grammaire
- ponctuation
- simplification de phrase
- détection des formulations trop longues ou peu accessibles

## Noyau minimal recommandé

Si l'on implémente plus tard un premier lot limité, commencer par :
- supprimer la sélection
- insérer au curseur
- insérer au curseur par saisie audio
- remplacer la sélection par saisie audio
- ajouter à la fin par saisie audio
- réécrire la sélection
- compléter la phrase
- mots probables pendant la saisie

## Point technique important

Ces fonctions supposent de gérer correctement :
- la sélection du texte
- la position du curseur
- le remplacement partiel du contenu
- la conservation du reste du texte
- les raccourcis clavier associés

## Produits ou briques à étudier

Étudier plus tard s'il est préférable :
- d'implémenter ces aides dans l'application
- ou de s'appuyer sur des composants existants d'éditeur assisté

## Statut

Sujet identifié, à reprendre plus tard.
