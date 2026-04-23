# Tutoriel de gestion des paramètres

## Objet du document

Ce document explique la logique des paramètres de l'application de gestion optimisée des mails.
Il sert à :
- comprendre à quoi sert chaque paramètre ;
- distinguer ce qui est déjà simulé de ce qui sera réellement automatisé plus tard ;
- garder une base commune de décision pour la maintenance et l'évolution du produit.

Il doit être relu comme un document de référence fonctionnelle.

## Principe général

La page `Paramètres` est organisée autour de 4 blocs :
- `1. Affichage`
- `2. Accessibilité`
- `3. Assistance IA`
- `4. Gestion des mails`

Un popup d'aperçu en direct permet de simuler les conséquences visuelles et fonctionnelles des réglages.

Ce mécanisme de visualisation et de contrôle est facultatif, mais fortement préconisé :
- il aide à comprendre l'effet réel des réglages ;
- il facilite les tests ;
- il prépare les futurs usages réels de lecture assistée et d'automatisation.

Important :
- aujourd'hui, une partie du comportement est simulée ;
- plus tard, ces paramètres devront piloter le comportement réel du produit ;
- les fonctions de lecture assistée devront s'appliquer aussi bien à l'entrée (`input`) qu'à la sortie (`output`).

Cela signifie qu'à terme les mêmes possibilités de lecture devront exister :
- sur le mail reçu ;
- sur le résumé IA ;
- sur la proposition de réponse ;
- sur les variantes générées.

Cette règle est impérative :
- le mécanisme de lecture assistée ne doit pas être limité au seul texte d'entrée ;
- il doit exister à la fois sur l'`input` et sur l'`output`.

## 1. Affichage

### Finalité

Le bloc `Affichage` sert à améliorer le confort visuel de l'utilisateur et à l'aider à choisir une présentation adaptée à ses capacités de lecture et de fatigue visuelle.

### Aide à la décision

Le principe retenu est de permettre une visualisation directe du résultat obtenu.
Le popup doit donc montrer un rendu réaliste, pas seulement une liste de réglages.

### Paramètres

#### Thème

Le thème permet de modifier l'ambiance visuelle générale de l'application.

Objectifs :
- proposer plusieurs univers visuels ;
- garder un thème par défaut clair et cohérent ;
- permettre un changement rapide depuis la sidebar et un réglage plus réfléchi depuis `Paramètres`.

Règles retenues :
- le thème par défaut est le thème bleu `blue-violet` ;
- le thème en cours doit être visible ;
- les thèmes disponibles doivent être listés clairement ;
- le même choix doit être accessible depuis la sidebar et depuis `Paramètres`.

#### Police de caractère

Le choix de police sert à limiter la fatigue oculaire et à améliorer la lisibilité.

Polices proposées à ce stade :
- `Inter`
- `Atkinson Hyperlegible`
- `Lexend`
- `Source Sans 3`

Intention fonctionnelle :
- `Inter` : police de base polyvalente ;
- `Atkinson Hyperlegible` : orientation accessibilité/lisibilité ;
- `Lexend` : lecture prolongée plus confortable pour certains utilisateurs ;
- `Source Sans 3` : alternative neutre et robuste.

#### Taille du texte

La taille du texte permet d'ajuster la lisibilité générale de l'interface.

Valeurs retenues :
- `Normal`
- `Large`
- `Extra large`

#### Espacement des lignes

L'espacement des lignes réduit la densité visuelle et facilite la lecture des blocs textuels.

Valeurs retenues :
- `Standard`
- `Confort`
- `Très aéré`

#### Largeur de lecture

La largeur de lecture ne modifie pas la taille de l'écran ou de la page, mais la largeur utile des lignes de texte.

Objectif :
- réduire le nombre de mots par ligne ;
- rendre la lecture plus confortable pour certains profils ;
- conserver le même cadre de travail général.

Valeurs retenues :
- `Standard`
- `Réduite`
- `Très réduite`

#### Contraste renforcé

Le contraste renforcé n'est pas retenu comme mode général actif pour le moment.

Décision actuelle :
- il est conservé comme simulation dans le popup ;
- il sert uniquement d'aide à la décision ;
- il permettra plus tard de décider s'il mérite d'être intégré réellement dans l'UI.

#### Animations

Il y a actuellement très peu d'animations dans l'application.

Décision actuelle :
- ne pas en faire un réglage prioritaire ;
- réfléchir plus tard aux animations utiles à ajouter ;
- ne pas complexifier le paramétrage sans bénéfice clair.

## 2. Accessibilité

### Finalité

Le bloc `Accessibilité` sert à réduire l'effort moteur et cognitif.
Il structure la manière dont le contenu est lu, affiché et parcouru.

### Logique retenue

Après discussion, la logique suivante a été retenue.

Il faut distinguer :
- ce qui détermine la quantité de contenu visible ;
- ce qui détermine si la lecture progresse manuellement ou automatiquement ;
- ce qui servira plus tard à piloter le rythme de lecture automatique.

### Paramètres

#### Vitesse de scroll

La vitesse de scroll règle la rapidité du déplacement lors d'un défilement simulé ou assisté.

Valeurs retenues :
- `Lent`
- `Normal`
- `Rapide`

Usage actuel :
- utilisée dans le popup de test.

Usage futur :
- pourra servir de référence pour des aides au défilement plus avancées.

#### Quantité affichée à chaque étape

C'est le paramètre central.
Il détermine la quantité de contenu visible à chaque étape de lecture.

Valeurs retenues :
- `1 paragraphe`
- `2 paragraphes`
- `3 paragraphes`
- `Illimité`

Décision importante :
- ce paramètre est obligatoire ;
- la valeur par défaut est `1 paragraphe`.

En mode manuel :
- l'utilisateur avance avec des flèches `précédent / suivant`.

En mode automatique :
- cette quantité reste la base de calcul du passage d'une étape à la suivante.

#### Unité de progression

L'unité de progression est une valeur numérique exprimée en `millisecondes par mot`.

Ce n'est pas un type de découpage du texte.
Ce n'est pas `paragraphe`, `bloc` ou `écran`.

Rôle retenu :
- représenter un temps moyen standard de lecture ;
- permettre un ajustement par l'utilisateur selon ses capacités ;
- servir plus tard au calcul automatique du rythme de lecture.

Exemple de logique future :
- le système connaît la quantité de texte à afficher ;
- il estime le nombre de mots à lire ;
- il calcule automatiquement la durée nécessaire à partir du temps moyen `ms/mot`.

#### Lecture progressive

La lecture progressive ne désigne pas la quantité affichée.
Elle désigne le mode d'avancement de la lecture.

Valeurs retenues :
- `Activée`
- `Désactivée`

Signification :
- `Désactivée` : lecture manuelle ;
- `Activée` : lecture automatique possible.

Aujourd'hui :
- la lecture automatique est simulée dans le popup.

Plus tard :
- elle devra être réellement pilotée par l'unité de progression ;
- elle devra pouvoir fonctionner aussi avec une future option audio.

#### Taille des boutons

Ce paramètre adapte les commandes de l'interface aux besoins moteurs de l'utilisateur.

Valeurs retenues :
- `Normal`
- `Large`
- `Extra large`

#### Confirmations renforcées avant action

Ce paramètre permet d'ajouter des validations supplémentaires avant les actions sensibles.

Objectif :
- éviter les erreurs ;
- rassurer l'utilisateur ;
- limiter les suppressions ou validations involontaires.

#### Option audio

L'option audio doit être prévue dès maintenant dans les spécifications.

Décision actuelle :
- elle existe comme orientation fonctionnelle ;
- elle n'est pas encore implémentée ;
- elle devra être articulée plus tard avec la lecture progressive.

Fonctions visées plus tard :
- lecture vocale du contenu ;
- synchronisation avec la progression visuelle ;
- possibilité de pause, reprise et repositionnement.

### Fonctionnalités de lecture assistée retenues

Le système de lecture assistée ne doit pas se limiter à l'entrée.
Il doit pouvoir s'appliquer à tout contenu textuel.

Fonctionnalités retenues :
- progression manuelle par flèches ;
- lecture automatique ;
- pause ;
- reprise ;
- repositionnement sur un mot ;
- surbrillance mot par mot ;
- futur audio.

Important :
- ces fonctions doivent s'appliquer aussi bien à l'entrée (`input`) qu'à la sortie (`output`).

### Pause et intention de modification

Une demande de `Pause` doit etre interpretee comme un signal potentiellement important :
- elle peut correspondre a une intention de modification ;
- elle peut aussi marquer un point d'attention a reprendre ensuite ;
- cette information sera importante plus tard pour les usages plus automatises, notamment avec Browser Use.

Decision actuelle :
- pour le moment, les modifications restent manuelles ;
- la pause sert surtout a localiser et retrouver l'endroit ou l'utilisateur souhaite intervenir.

Orientation future :
- l'utilisateur pourra aussi exprimer la modification souhaitee par prompt ;
- une reformulation assistee par IA pourra alors etre envisagee dans certains cas ;
- cette aide restera a cadrer plus tard ;
- une adaptation plus fine devra probablement etre pensee avec des ergotherapeutes quand le produit sera plus mature.

### Premiere aide a la modification envisagee

La premiere aide simple et realiste a introduire plus tard serait :
- une proposition de mots a partir de quelques frappes de caracteres ;
- avec plusieurs choix a selectionner rapidement.

Cette aide est distincte :
- de la modification entierement manuelle ;
- de l'expression d'une demande de modification par prompt ;
- et de la reformulation assistee par IA.

## 3. Assistance IA

### Finalité

Le bloc `Assistance IA` sert à déterminer comment l'assistant produit son aide rédactionnelle.

Aujourd'hui :
- la page `Paramètres` utilise une simulation ;
- `Mistral local` n'est pas encore réellement appelé dans le popup ;
- la logique actuelle permet de tester les effets attendus des réglages.

Plus tard :
- ces paramètres devront piloter la vraie génération.
- en création de mail, il faudra distinguer clairement le modèle servant à construire le prompt d'entrée et le modèle servant à rédiger le mail de sortie.

### Paramètres

#### Modèle IA par défaut

Ce paramètre désigne le moteur utilisé par défaut.

Aujourd'hui :
- `Mistral local` est le modèle cible affiché.

Plus tard :
- il servira au choix réel du moteur de génération si plusieurs modèles sont disponibles.
- dans les tests avancés, il pourra être décliné en plusieurs usages selon le flux traité.

### Distinction importante en création de mail

En mode `Création`, il faut distinguer deux usages différents de l'IA :

- `LLM d'entrée`
  Il sert à analyser le besoin utilisateur et à générer ou structurer le prompt d'entrée.
  Son rôle est d'aider à formuler correctement ce qui doit être demandé ou rédigé.

- `LLM de sortie`
  Il sert à produire le mail rédigé.
  Il peut être identique au modèle d'entrée ou différent.

Cette distinction est importante car :
- le modèle le plus pertinent pour construire un bon prompt n'est pas forcément celui qui rédigera le meilleur mail ;
- les futurs tests réels devront permettre de comparer les deux usages ;
- la page de visualisation doit aider à comprendre cette séparation.

#### Niveau d'assistance

Ce paramètre règle jusqu'où va l'aide fournie par l'IA.

Valeurs retenues :
- `Suggestion simple`
- `Assistance active`
- `Assistance avancée`

Signification :
- `Suggestion simple` : brouillon de base, peu d'aide annexe ;
- `Assistance active` : résumé + brouillon + guidage intermédiaire ;
- `Assistance avancée` : résumé, brouillon, rappels utiles, conseil d'action.

#### Ton par défaut

Ce paramètre règle le style rédactionnel de la réponse générée.

Valeurs retenues :
- `Professionnel`
- `Chaleureux`
- `Court`

Signification :
- `Professionnel` : formulation sobre et formelle ;
- `Chaleureux` : formulation plus humaine et plus douce ;
- `Court` : formulation directe et condensée.

#### Longueur par défaut

Ce paramètre règle la taille de la réponse générée.

Valeurs retenues :
- `Courte`
- `Standard`
- `Détaillée`

#### Génération

Ce paramètre règle le moment où la proposition IA apparaît.

Valeurs retenues :
- `Sur demande`
- `Automatique`

Signification :
- `Sur demande` : il faut cliquer sur `Générer` ;
- `Automatique` : la proposition apparaît immédiatement.

#### Comparaison de plusieurs tons et longueurs

Ce paramètre autorise ou non la comparaison de variantes.

S'il est activé :
- plusieurs formulations peuvent être comparées ;
- l'utilisateur peut choisir la meilleure.

## 4. Gestion des mails

### Finalité

Le bloc `Gestion des mails` règle le comportement métier général de l'application.

### Paramètres

#### Mode par défaut

Valeurs retenues :
- `Création`
- `Réponse`

Ce paramètre choisit le contexte de travail principal de l'utilisateur.

#### Gestion des pièces jointes

Valeurs retenues :
- `Signaler uniquement`
- `Ouverture manuelle`
- `Ouverture assistée si nécessaire`

Objectif :
- encadrer le niveau d'intervention de l'application sur les pièces jointes.

#### Afficher la classification

Affiche ou masque la catégorie du mail.

#### Afficher la priorité

Affiche ou masque le niveau d'urgence ou d'importance.

#### Simulation d'envoi activée

Décision très importante en phase locale.

Si activée :
- les envois sont simulés ;
- aucun vrai mail n'est envoyé.

#### Validation obligatoire avant envoi

Si activée :
- aucune réponse ne part sans validation explicite.

#### Confirmation avant suppression

Si activée :
- toute suppression sensible doit être confirmée.

#### Brouillon automatique

Si activé :
- un brouillon peut être préparé ou conservé automatiquement.

## Recommandations actuelles

### Réglages par défaut recommandés

Pour la phase locale actuelle, les recommandations sont les suivantes.

#### Affichage
- thème bleu `blue-violet` ;
- police `Inter` ou `Atkinson Hyperlegible` ;
- texte `Standard` ;
- interligne `Confort` selon profil ;
- largeur de lecture `Standard` ou `Réduite`.

#### Accessibilité
- vitesse de scroll `Normal` ;
- quantité affichée `1 paragraphe` ;
- unité de progression autour de `320 ms/mot` ;
- lecture progressive désactivée par défaut puis testable ;
- boutons `Large` si besoin ;
- confirmations renforcées activées.

#### Assistance IA
- `Mistral local` ;
- `Assistance active` ;
- ton `Professionnel` ;
- longueur `Standard` ;
- génération `Sur demande` ;
- comparaison activée.

#### Gestion des mails
- mode `Réponse` ;
- pièces jointes `Ouverture manuelle` ;
- classification visible ;
- priorité visible ;
- simulation d'envoi activée ;
- validation obligatoire activée ;
- confirmation suppression activée ;
- brouillon automatique activé selon besoin.

## Statut du popup actuel

Le popup actuel permet de tester :
- une simulation de lecture assistée ;
- la progression manuelle ;
- une lecture automatique simulée ;
- une surbrillance mot par mot ;
- la pause / reprise ;
- un repositionnement sur mot ;
- une simulation des réglages d'assistance IA ;
- une simulation du comportement métier.

Le popup de visualisation et de contrôle :
- n'est pas obligatoire pour utiliser le produit ;
- mais il est recommandé pour comprendre, tester et valider les paramètres avant usage réel.

Il ne faut pas le confondre avec la logique définitive du produit :
- certaines fonctions sont déjà cohérentes ;
- d'autres restent des simulations préparatoires.

## Décision structurante retenue

Les fonctions de lecture assistée ne doivent pas être réservées au seul texte d'entrée.
Elles doivent être conçues comme un mécanisme commun `input/output`.

Elles devront être applicables :
- au contenu source ;
- au résumé IA ;
- à la réponse générée ;
- aux variantes ;
- plus tard à l'audio.

C'est une règle produit importante pour la suite du projet.
