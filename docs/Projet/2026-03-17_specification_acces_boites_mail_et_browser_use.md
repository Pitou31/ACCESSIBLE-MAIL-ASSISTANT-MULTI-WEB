# Specification future - acces aux boites mail et articulation avec Browser Use

Date : 2026-03-17

## 1. Objet du document

Ce document formalise la future gestion d'acces aux boites mail du produit.
Il prolonge les documents deja rediges sur :
- les comptes ;
- les roles ;
- les droits ;
- les boites mail ;
- la preparation des versions automatisees.

Il precise aussi la place future de `Browser Use` dans cette architecture.

## 2. Principe general retenu

L'application ne doit pas raisonner seulement en termes d'utilisateurs, mais en termes de :
- comptes ;
- roles ;
- boites mail ;
- droits sur chaque boite ;
- traces d'actions ;
- niveau d'automatisation autorise.

Le point central n'est donc pas seulement "qui est connecte", mais :
- a quelle boite mail la personne a acces ;
- ce qu'elle peut y faire ;
- quel niveau d'assistance ou d'automatisation est autorise sur cette boite.

## 3. Ressources a proteger

Les ressources sensibles a encadrer sont :
- la connexion a une boite mail ;
- la liste des messages ;
- le contenu des mails ;
- les pieces jointes ;
- les brouillons ;
- les reponses envoye es ;
- les parametres appliques a une boite ;
- les statistiques et journaux d'actions.

## 4. Entites fonctionnelles a retenir

Les entites deja identifiees restent valables :
- `users`
- `account_requests`
- `mailboxes`
- `mailbox_members`
- `mail_actions`
- `user_stats`

Il faut en plus prevoir a terme des entites ou journaux complementaires :
- `mailbox_connections`
- `automation_policies`
- `browser_use_sessions`
- `message_drafts`
- `message_reviews`

## 5. Mailbox comme ressource principale

Une boite mail doit etre consideree comme une ressource partageable.

Une meme boite pourra etre :
- traitee par un seul utilisateur ;
- partagee entre plusieurs utilisateurs ;
- supervis ee par un validateur ;
- administree par un compte a droits elargis.

Le produit doit donc permettre :
- plusieurs membres sur une meme boite ;
- plusieurs niveaux de permission ;
- une tracabilite par utilisateur et par boite.

## 6. Niveaux de droits recommandes

En plus du role global, chaque boite mail doit porter des droits fins.

Niveaux recommandes :
- `connect`
- `read`
- `draft`
- `modify`
- `validate`
- `send`
- `manage_mailbox`
- `view_stats`
- `manage_automation`

### Sens des droits

`connect`
- autorise l'ouverture de session ou l'usage d'un connecteur existant pour la boite.

`read`
- autorise la lecture de la liste des mails et de leur contenu.

`draft`
- autorise la creation de brouillons.

`modify`
- autorise la modification manuelle ou assistee des brouillons.

`validate`
- autorise la validation humaine avant envoi.

`send`
- autorise l'envoi effectif des messages.

`manage_mailbox`
- autorise la gestion des reglages de la boite, de ses membres et de ses politiques.

`view_stats`
- autorise la consultation des statistiques detaillees de la boite.

`manage_automation`
- autorise le pilotage de Browser Use et des futurs automatismes sur la boite.

## 7. Parametres par boite mail

Les parametres ne doivent pas etre seulement personnels.
Il faudra distinguer a terme :
- les parametres utilisateur ;
- les parametres de la boite mail ;
- les politiques d'automatisation.

Exemples de parametres par boite :
- LLM d'entree par defaut ;
- LLM de sortie par defaut ;
- ton de sortie recommande ;
- longueur par defaut ;
- simulation d'envoi activee ou non ;
- validation obligatoire ;
- niveau d'automatisation autorise ;
- Browser Use autorise ou non ;
- pieces jointes autorisees ou non ;
- journalisation obligatoire ;
- niveau d'acces aux statistiques.

## 8. Place future de Browser Use

`Browser Use` n'est pas un simple outil annexe.
Dans les versions 2 et 3, il pourra jouer le role d'agent operateur navigateur.

Son champ d'action potentiel concerne :
- la connexion a une webmail ;
- la navigation dans la boite ;
- l'ouverture d'un message ;
- la collecte d'informations utiles au traitement ;
- l'execution de certaines actions de workflow ;
- la preparation ou le depot d'une reponse ;
- l'alimentation des journaux et statistiques.

Mais `Browser Use` ne doit jamais etre considere comme un acteur autonome sans garde-fous.

Il doit etre pilote par :
- les droits du compte ;
- les droits de la boite mail ;
- les parametres actifs ;
- le niveau d'automatisation autorise ;
- la politique de validation humaine.

## 9. Principes de securite et de gouvernance

### 9.1 Separation des responsabilites

Il faut distinguer :
- l'utilisateur humain ;
- l'assistant IA de generation ;
- l'agent navigateur `Browser Use` ;
- le moteur de lecture / accessibilite ;
- le mecanisme d'envoi reel.

### 9.2 Validation avant action sensible

Les actions suivantes devront etre specialement encadrees :
- ouverture de session sur une boite ;
- lecture de messages sensibles ;
- ouverture de pieces jointes ;
- creation de brouillons ;
- modification automatique d'un contenu ;
- envoi reel d'une reponse ;
- suppression ou archivage d'un message.

### 9.3 Journalisation

Chaque action importante devra pouvoir etre tracee :
- qui a initie l'action ;
- quel moteur ou agent l'a executee ;
- sur quelle boite ;
- sur quel message ;
- avec quel resultat ;
- a quelle date.

## 10. Niveaux d'automatisation recommandes

### Version 1
Produit manuel assiste

Caracteristiques :
- acces humain direct ;
- IA sur demande ;
- Browser Use absent ou non autorise ;
- validation humaine partout.

### Version 2
Produit semi-automatise

Caracteristiques :
- Browser Use autorise sur certaines etapes ;
- collecte et navigation assistees ;
- IA plus integree ;
- validation humaine toujours centrale avant envoi.

### Version 3
Produit automatise avance

Caracteristiques :
- orchestration plus poussee ;
- Browser Use utilise sur un plus grand nombre d'etapes ;
- traitement plus fluide ;
- garde-fous forts sur les boites et actions autorisees.

## 11. Workflow cible d'acces a une boite mail

1. L'utilisateur ouvre sa session.
2. Le systeme charge son role global.
3. Le systeme charge la liste des boites mail autorisees.
4. L'utilisateur choisit une boite ou le systeme ouvre la boite par defaut.
5. Les droits effectifs sont calcules :
   - droits utilisateur ;
   - droits sur la boite ;
   - politique d'automatisation ;
   - etat du produit local.
6. Le parcours disponible est adapte.
7. Les actions sont journalisees.

## 12. Usage cible de Browser Use sur les boites mail

### Ce que Browser Use pourra faire plus tard

- ouvrir l'interface webmail ;
- se connecter avec un mecanisme autorise ;
- lister les messages utiles ;
- ouvrir le message cible ;
- recuperer les informations de contexte ;
- preparer la zone de reponse ;
- inserer un brouillon valide ;
- lancer l'envoi si les droits et validations le permettent ;
- relever certains indicateurs d'execution.

### Ce que Browser Use ne doit pas faire sans cadre explicite

- contourner une politique de validation humaine ;
- envoyer un message si la boite ne l'autorise pas ;
- changer librement les parametres ;
- agir sur une boite non autorisee ;
- masquer ou effacer les journaux.

## 13. Implications sur la page mail

La page `mail.html` devra a terme distinguer clairement :
- la boite mail active ;
- les droits de l'utilisateur sur cette boite ;
- le niveau d'automatisation actif ;
- la presence ou non de Browser Use dans le flux courant ;
- l'etat du brouillon ;
- l'etat de validation ;
- l'etat d'envoi.

## 14. Ce qu'il faut retenir

La future gestion d'acces aux boites mail doit reposer sur quatre idees fortes :
- la boite mail est une ressource partageable et gouvernee ;
- les droits doivent etre fins et traces ;
- Browser Use est un agent d'execution, pas un decideur libre ;
- l'automatisation doit progresser par paliers, jamais d'un seul bloc.
