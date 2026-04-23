# Scenario d'automatisation - Browser Use du debut a la fin du traitement mail

Date : 2026-03-17

## 1. Objet du document

Ce document decrit :
- les roles possibles de `Browser Use` dans le produit ;
- un scenario d'automatisation progressif ;
- les processus concernes, de la connexion a la boite mail jusqu'a l'envoi ;
- la maniere d'y parvenir sans casser l'approche prudente retenue jusqu'ici.

L'objectif n'est pas de tout automatiser tout de suite, mais de decrire une trajectoire realiste.

## 2. Principe directeur

`Browser Use` doit etre considere comme un agent d'execution navigateur.

Il ne remplace pas :
- l'utilisateur ;
- les parametres ;
- les IA de generation ;
- la validation humaine ;
- les politiques de droits.

Il execute dans le navigateur ce que le systeme lui autorise a faire.

## 3. Roles possibles de Browser Use

### 3.1 Connexion et acces a la boite mail

`Browser Use` peut :
- ouvrir l'interface de webmail ;
- naviguer vers la page de connexion ;
- reutiliser une session deja ouverte si elle existe ;
- aider a atteindre la bonne boite ou le bon dossier.

### 3.2 Exploration de la boite

`Browser Use` peut :
- lister les messages visibles ;
- filtrer selon certaines regles ;
- ouvrir un message cible ;
- revenir a la liste ;
- naviguer entre les dossiers ou etiquettes utiles.

### 3.3 Collecte de contexte

`Browser Use` peut :
- recuperer l'objet ;
- recuperer l'expediteur ;
- recuperer la date ;
- recuperer le corps du message ;
- detecter la presence de pieces jointes ;
- noter certains elements de priorite ou de classification visibles.

### 3.4 Application des parametres

`Browser Use` peut respecter les parametres definis par :
- l'utilisateur ;
- la boite mail ;
- le niveau d'automatisation ;
- les regles produit.

Il ne choisit pas librement :
- le LLM ;
- le ton ;
- la longueur ;
- la politique d'envoi ;
- les droits d'action.

### 3.5 Appel des IA

`Browser Use` n'est pas lui-meme l'IA de generation.
En revanche, il peut jouer un role autour de l'appel des IA :
- fournir le texte source ;
- transmettre le contexte ;
- reinjecter le resultat dans la bonne zone ;
- demander une autre variante si le workflow le prevoit.

### 3.6 Aide aux modifications

Dans un premier temps :
- Browser Use ne doit pas modifier librement le texte final sans validation.

Plus tard, il pourra :
- assister une reformulation demandee ;
- appliquer une modification precise exprimee par prompt ;
- aider a repositionner l'utilisateur dans le texte ;
- utiliser le signal `pause` comme marqueur potentiel d'intention de modification.

### 3.7 Preparation a l'envoi

`Browser Use` peut :
- ouvrir la zone de reponse ;
- coller ou inserer le brouillon valide ;
- verifier que les champs essentiels sont presents ;
- laisser l'utilisateur relire ;
- attendre l'autorisation d'envoi.

### 3.8 Envoi

Selon les droits et le niveau de version :
- il peut ne jamais envoyer lui-meme ;
- ou preparer l'envoi puis attendre une confirmation ;
- ou envoyer reellement si les politiques l'autorisent.

### 3.9 Statistiques et traces

`Browser Use` peut contribuer a :
- enregistrer les etapes franchies ;
- mesurer les temps de traitement ;
- consigner si un brouillon a ete genere ;
- consigner si un envoi a ete realise ;
- alimenter les statistiques par utilisateur et par boite mail.

## 4. Scenario cible d'automatisation

### Etape 1 - Acces a la boite mail

1. L'utilisateur choisit sa boite mail autorisee.
2. Le systeme verifie :
   - les droits ;
   - les parametres actifs ;
   - le niveau d'automatisation ;
   - l'autorisation d'utiliser Browser Use.
3. Browser Use ouvre la boite si le workflow l'autorise.

### Etape 2 - Selection du message

1. Browser Use ouvre la liste des mails.
2. Il applique si besoin des regles simples :
   - non lus ;
   - prioritaires ;
   - appartenant a certaines categories.
3. Il ouvre le message cible.
4. Le systeme capture les donnees utiles.

### Etape 3 - Analyse et pre-traitement

1. Le texte recupere est passe au flux d'analyse.
2. Les parametres du produit sont appliques :
   - mode creation ou reponse ;
   - LLM d'entree ;
   - LLM de sortie ;
   - ton ;
   - longueur ;
   - niveau d'assistance.
3. Une proposition est produite.

### Etape 4 - Lecture et controles utilisateur

1. L'utilisateur lit l'input.
2. L'utilisateur lit l'output.
3. Les fonctions de lecture assistee peuvent etre utilisees.
4. Une demande de `pause` peut etre interpretee comme un signal de modification potentielle.
5. Pour le moment, la modification reste manuelle.

### Etape 5 - Modifications

Mode actuel recommande :
- modification manuelle.

Modes futurs possibles :
- modification exprimee par prompt ;
- reformulation assistee ;
- suggestion de mots apres quelques frappes ;
- aide plus fine co-concue avec des ergotherapeutes.

### Etape 6 - Validation

1. L'utilisateur valide le brouillon.
2. Selon les droits, un validateur peut devoir intervenir.
3. Le statut du brouillon est mis a jour.

### Etape 7 - Injection et envoi

1. Browser Use reinjecte le texte valide dans le webmail si besoin.
2. Le systeme verifie la politique d'envoi :
   - simulation ;
   - validation obligatoire ;
   - envoi reel autorise ou non.
3. Si tout est autorise, l'envoi est execute.

### Etape 8 - Journalisation et statistiques

1. Le traitement est enregistre.
2. Les actions sont reliees :
   - a l'utilisateur ;
   - a la boite ;
   - au message ;
   - au ou aux moteurs utilises.
3. Les statistiques sont mises a jour.

## 5. Scenario d'automatisation par niveau de maturite

### Niveau A - Manuel assiste

Caracteristiques :
- Browser Use inactif ;
- IA sur demande ;
- lecture assistee disponible ;
- validation humaine partout.

### Niveau B - Navigation automatisee

Caracteristiques :
- Browser Use ouvre la boite et le mail ;
- collecte du contenu ;
- preparation du brouillon ;
- aucune autonomie d'envoi.

### Niveau C - Preparation automatisee complete

Caracteristiques :
- Browser Use navigue ;
- les IA generent ;
- les parametres pilotent le rendu ;
- l'utilisateur relit et modifie ;
- Browser Use peut reinjecter le texte dans le webmail.

### Niveau D - Envoi automatise sous garde-fous

Caracteristiques :
- envoi possible si les droits le permettent ;
- validation et journalisation obligatoires ;
- cadre reserve aux boites et profils explicitement autorises.

## 6. Comment y parvenir

### Phase 1 - Stabiliser l'existant

Avant toute automatisation poussee, il faut conserver :
- une page mail locale stable ;
- une page parametres exploitable ;
- une logique claire sur l'input et l'output ;
- une logique claire sur les droits.

### Phase 2 - Introduire un connecteur de boite mail

Il faudra definir un connecteur ou un adaptateur capable de :
- identifier la boite active ;
- lancer Browser Use dans le bon contexte ;
- verifier les autorisations avant toute action.

### Phase 3 - Creer un orchestrateur de workflow

Il faudra un orchestrateur central qui sache :
- lire les parametres actifs ;
- charger les droits ;
- appeler le bon LLM ;
- appeler Browser Use ;
- attendre les validations ;
- journaliser les etapes.

Cet orchestrateur ne doit pas etre melange au code d'interface.

### Phase 4 - Introduire des politiques d'automatisation

Chaque boite mail devra pouvoir definir :
- si Browser Use est autorise ;
- jusqu'ou il peut aller ;
- si l'envoi reel est autorise ;
- si une validation humaine est obligatoire ;
- quels journaux doivent etre conserves.

### Phase 5 - Renforcer la tracabilite

Il faudra journaliser a minima :
- l'ouverture de session ;
- la lecture d'un message ;
- la generation d'un brouillon ;
- les demandes de regeneration ;
- les modifications ;
- la validation ;
- l'envoi ;
- les erreurs.

## 7. Architecture fonctionnelle recommandee

Le futur systeme devra separer au moins cinq couches :

### Couche 1 - Interface utilisateur
- page mail ;
- page parametres ;
- pages de supervision.

### Couche 2 - Parametres et politiques
- preferences utilisateur ;
- regles par boite ;
- niveau d'automatisation ;
- garde-fous.

### Couche 3 - Orchestration metier
- choix du workflow ;
- choix du LLM ;
- coordination des etapes ;
- gestion des validations.

### Couche 4 - Agents d'execution
- Browser Use ;
- moteur audio ;
- futurs moteurs de transcription.

### Couche 5 - Donnees et journalisation
- comptes ;
- boites mail ;
- journaux ;
- statistiques ;
- historiques.

## 8. Points de vigilance

- ne pas laisser Browser Use prendre des decisions metier seul ;
- ne pas melanger droits et commodites d'interface ;
- ne pas autoriser l'envoi reel trop tot ;
- ne pas oublier que la pause peut devenir un signal exploitable ;
- garder les fonctions de lecture et de modification accessibles ;
- penser des maintenant a la reprise apres erreur.

## 9. Resume executif

Le chemin recommande est le suivant :

1. stabiliser les parcours manuels ;
2. encadrer finement les droits par boite mail ;
3. faire de Browser Use un agent d'execution sous controle ;
4. automatiser d'abord la navigation et la preparation ;
5. ne laisser l'envoi reel qu'aux cas explicitement autorises ;
6. journaliser chaque etape ;
7. enrichir ensuite l'aide a la modification et les statistiques.
