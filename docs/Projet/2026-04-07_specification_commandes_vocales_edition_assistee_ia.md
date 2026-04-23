# Specification - Commandes vocales d'edition assistee par IA

## 1. Objet

Cette specification decrit une extension de la dictée actuelle.

Le principe n'est pas de remplacer la reconnaissance vocale temps reel existante, mais d'ajouter un module d'interpretation locale des commandes d'edition.

Objectif : permettre a l'utilisateur de dicter des instructions de modification du texte, par exemple :
- `dans Bonjour madame mettre Mademoiselle devant Madame` ;
- `remplace ce mot par Demande` ;
- `ajoute merci a la fin` ;
- `mets cette phrase en plus poli`.

## 2. Principe general

Architecture cible :
- la reconnaissance vocale live continue a produire du texte rapidement ;
- un petit LLM local, deja charge en memoire pendant la session, interprete les commandes d'edition ;
- l'application applique ensuite une action locale et structuree sur le texte visible courant.

Le texte visible courant reste l'unique verite.
Aucune ancienne session de dictée ou ancienne commande ne doit etre reutilisee comme base bloquante.

## 3. Cas d'usage cibles

### 3.1 Corrections locales de texte

Exemples :
- remplacer un mot ou une expression ;
- inserer un mot avant ou apres une cible ;
- corriger une selection ;
- ajouter du texte a la fin.

### 3.2 Reformulations locales

Exemples :
- rendre une phrase plus polie ;
- raccourcir une phrase ;
- clarifier une phrase selectionnee ;
- remettre de la ponctuation sur le dernier segment dicte.

### 3.3 Commandes vocales d'edition

Exemples :
- `mets Mademoiselle devant Madame` ;
- `remplace Madame par Mademoiselle` ;
- `supprime cette phrase` ;
- `ajoute cordialement a la fin`.

## 4. Ce qui ne doit pas etre fait

Le module ne doit pas :
- reecrire tout le mail a chaque commande ;
- relancer une analyse complete du mail ;
- corriger silencieusement l'ensemble du texte ;
- proteger des zones deja modifiees ;
- reintroduire du contenu provenant d'anciennes actions.

## 5. Mode de fonctionnement recommande

### 5.1 Separation des roles

- STT live : transforme la parole en texte rapidement.
- LLM local resident : interprete la commande d'edition.
- Editeur : applique une transformation locale sur le texte courant.

### 5.2 Mode resident

Le LLM local doit rester charge pendant la session afin d'eviter un cout de demarrage a chaque action.

Le systeme n'envoie au modele que :
- la commande vocale ;
- la selection courante ou la cible courante ;
- une fenetre de contexte locale autour de la zone a modifier.

Le systeme n'envoie pas tout le mail sauf exception explicite.

## 6. Sortie attendue du modele

Le modele ne doit pas renvoyer directement un mail complet.

Il doit renvoyer une instruction d'edition structuree.

Format cible minimal :

```json
{
  "action": "insert_before",
  "target": "Madame",
  "text": "Mademoiselle ",
  "confidence": 0.93
}
```

Actions minimales a supporter en version 1 :
- `replace_selection`
- `replace_text`
- `insert_before`
- `insert_after`
- `move_caret`
- `insert_line_break`
- `append_end`
- `delete_selection`

Actions utiles ensuite :
- `rewrite_selection`
- `punctuate_last_segment`
- `shorten_selection`
- `polish_selection`

## 7. Regles d'execution

### 7.1 Regle principale

Le texte affiche au moment de l'action est la seule base de travail.

### 7.2 Regle de perimetre

Une commande ne doit agir que sur :
- la selection courante ;
- la cible textuelle explicite ;
- ou la fin du texte pour les ajouts en fin.

Regle par defaut :
- si l'utilisateur dit simplement `ecris ...`, `insere ...` ou `mets ...` sans cible explicite ni mention de fin, l'action se fait a l'emplacement courant du curseur ;
- si une selection est active, cette selection est remplacee ;
- sinon, le texte est insere au curseur courant.

### 7.3 Regle d'incertitude

Si la cible est ambigue, aucune modification automatique ne doit etre appliquee.

Le systeme doit alors :
- soit demander confirmation ;
- soit afficher un message du type `cible ambiguë, aucune modification appliquee`.

### 7.4 Regle de securite

Une commande d'edition ne doit jamais effacer silencieusement un travail precedent hors de sa zone cible.

## 8. Interaction utilisateur cible

### 8.1 Sequence nominale

1. l'utilisateur selectionne un texte ou place le curseur ;
2. l'utilisateur prononce une commande d'edition ;
3. la commande est transcrite ;
4. le LLM local resident produit une action structuree ;
5. l'editeur applique l'action localement ;
6. l'utilisateur peut continuer a dicter ou corriger.

### 8.2 Exemples

Exemple A :
- texte : `Bonjour madame`
- commande : `mettre Mademoiselle devant Madame`
- sortie attendue : insertion locale avant `madame`

Exemple B :
- texte selectionne : `Je veux savoir`
- commande : `rends cette phrase plus polie`
- sortie attendue : reformulation locale de la selection seulement

Exemple C :
- texte courant : `Merci`
- commande : `ajoute cordialement a la fin`
- sortie attendue : ajout en fin uniquement

Exemple D :
- texte courant : `Bonjour Madame, Monsieur`
- commande : `va a la ligne`
- sortie attendue : insertion d'un saut de ligne au curseur courant

Variantes equivalentes attendues :
- `a la ligne`
- `retour a la ligne`
- `saut de ligne`
- `saute une ligne`

Exemple E :
- texte courant : `Bonjour Madame, Monsieur`
- commande : `place le curseur avant Monsieur`
- sortie attendue : deplacement local du curseur avant `Monsieur`

Exemple F :
- texte courant : `Bonjour Madame, Monsieur`
- commande : `mets le curseur a la fin`
- sortie attendue : deplacement local du curseur en fin de texte

Exemple G :
- texte courant : `Bonjour Madame, Monsieur`
- curseur place entre `Bonjour` et `Madame`
- commande : `ecris Je suis desole,`
- sortie attendue : insertion locale du texte a l'emplacement courant du curseur

## 9. Contraintes de performance

Cette fonction n'est viable que si la reponse du modele reste compatible avec l'edition.

Cible pratique :
- commande simple : environ 1 a 2 secondes idealement ;
- au-dela de quelques secondes, l'usage devient inconfortable.

Consequences :
- privilegier un petit modele local rapide ;
- eviter les gros modeles generalistes pour les commandes courtes ;
- garder les traitements lourds pour des actions ponctuelles hors flux de dictée.

## 10. Modeles locaux adaptes

Dans l'etat actuel du projet, un modele local rapide de type Mistral est plus adapte qu'un gros modele lourd pour ce role.

Le critere principal n'est pas seulement la qualite theorique du modele, mais la vitesse reelle de reponse en situation d'edition.

## 11. Strategie de mise en oeuvre

### 11.1 Etape 1 - Version minimale

Implementer seulement :
- `replace_selection`
- `replace_text`
- `insert_before`
- `insert_after`
- `move_caret`
- `insert_line_break`
- `append_end`

Sans reformulation complexe.

### 11.2 Etape 2 - Reformulations locales

Ajouter ensuite :
- polissage de selection ;
- raccourcissement ;
- ponctuation locale ;
- clarification d'une phrase.

### 11.3 Etape 3 - Session residente

Maintenir le modele local charge pendant la session de travail afin de reduire la latence et stabiliser l'experience.

## 12. Garde-fous fonctionnels

Le module doit respecter les garde-fous suivants :
- ne jamais proteger une zone deja modifiee ;
- ne jamais rejouer une ancienne action ;
- ne jamais reintroduire du texte d'une ancienne session ;
- toujours repartir du texte visible courant ;
- interrompre l'action si la cible n'est pas assez claire.

## 13. Decision actuelle

La piste est jugee pertinente.

Elle devra etre testee plus tard avec un LLM local resident suffisamment rapide.

La version cible a privilegier est une interpretation locale des commandes d'edition, et non une reecriture permanente de toute la dictée par l'IA.
