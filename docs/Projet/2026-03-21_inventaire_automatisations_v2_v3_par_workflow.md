# Inventaire des automatisations V2 V3 par workflow

Date : 2026-03-21

## 1. Objet

Ce document liste les automatisations possibles non plus par page, mais par workflow metier.

## 2. Workflows principaux

Workflows retenus :
- connexion utilisateur ;
- acces a la boite mail ;
- rafraichissement de l'inbox ;
- selection du mail ;
- lecture du mail ;
- traitement des pieces jointes ;
- generation de brouillon ;
- modification / reprise ;
- injection du brouillon ;
- validation ;
- envoi ;
- rejet / suppression / archivage ;
- traitement automatique en file.

## 3. Tableau d'ensemble

| Workflow | V2 | V3 |
|---|---|---|
| Connexion utilisateur | Assistance de saisie et de navigation | Parcours plus intelligent selon contexte |
| Acces a la boite mail | Ouverture guidee de la bonne connexion | Ouverture et reprise de contexte quasi automatiques |
| Rafraichissement inbox | Declenchement assiste | Declenchement proactif selon workflow |
| Selection du mail | Ouverture du mail prioritaire | Parcours de plusieurs mails selon priorite et regles |
| Lecture du mail | Scroll et saut vers les zones utiles | Navigation plus autonome dans le contenu |
| Pieces jointes | Acces assiste aux zones pertinentes | Orchestration plus complete avec parcours du contexte visible |
| Generation de brouillon | Lancement assiste, reprise sur la trace IA | Generation plus integree dans un workflow complet |
| Modification / reprise | Repositionnement du curseur et de la vue | Aide plus fine a la reprise du travail |
| Injection du brouillon | Reinjection assistee apres validation | Reinjection plus fluide sur plusieurs cas d'usage |
| Validation | Toujours humaine | Toujours humaine ou assouplie selon politique explicite |
| Envoi | Pas d'envoi auto par defaut | Envoi conditionnel autorise si droits et politique le permettent |
| Rejet / suppression / archivage | Tres encadre | Plus large mais toujours sous garde-fous |
| Traitement automatique en file | Aide partielle | Orchestration multi-messages plus poussee |

## 4. Detail par workflow

### Connexion utilisateur

V2 :
- focus automatique ;
- passage champ a champ ;
- clic assiste sur le bon bouton ;
- affichage direct du resultat.

V3 :
- choix plus intelligent entre connexion, verification de statut ou reprise de session ;
- navigation plus autonome jusqu'au bon etat.

### Acces a la boite mail

V2 :
- selection assistee de la bonne connexion ;
- ouverture de l'inbox ;
- retour vers la zone utile.

V3 :
- reprise quasi automatique de la bonne boite ;
- orientation proactive vers la zone de traitement.

### Rafraichissement de l'inbox

V2 :
- clic assiste sur le rafraichissement ;
- retour direct sur la liste des messages.

V3 :
- rafraichissement integre dans un workflow plus long ;
- reprise automatique de la file.

### Selection du mail

V2 :
- choix du mail prioritaire ;
- ouverture assistee ;
- affichage centre sur le bon contenu.

V3 :
- parcours de plusieurs messages ;
- tri dynamique selon priorite, statut et politique.

### Lecture du mail

V2 :
- scroll guide ;
- acces rapide au corps du message ;
- acces rapide aux blocs utiles.

V3 :
- navigation plus autonome dans les differentes parties du message ;
- sequence de lecture plus complete.

### Traitement des pieces jointes

V2 :
- aide pour aller vers la zone pieces jointes ;
- maintien du principe de pre-traitement par l'application avant IA.

V3 :
- parcours plus complet autour des zones utiles du message et des metadonnees visibles.

### Generation de brouillon

V2 :
- declenchement assiste ;
- mise en avant de la trace IA ;
- retour sur le brouillon genere.

V3 :
- generation plus integree dans une sequence continue de travail.

### Modification / reprise

V2 :
- retour guide vers le bon bloc ;
- repositionnement du curseur dans la zone editable.

V3 :
- aides plus fines a la reprise et a la reformulation.

### Injection du brouillon

V2 :
- ouverture de la bonne zone dans le webmail ;
- collage du texte valide ;
- retour a l'utilisateur pour relecture.

V3 :
- reinjection plus fluide et plus generale ;
- eventuelle gestion de plusieurs cas d'usage.

### Validation

V2 :
- validation humaine obligatoire.

V3 :
- validation humaine prioritaire ;
- assouplissement possible seulement sur politiques explicites.

### Envoi

V2 :
- pas d'envoi automatique par defaut.

V3 :
- envoi conditionnel et limite aux cas explicitement autorises.

### Rejet / suppression / archivage

V2 :
- operations tres encadrees ;
- confirmations fortes.

V3 :
- operations plus integrables au workflow, mais jamais sans gouvernance.

### Traitement automatique en file

V2 :
- aide partielle au passage d'un message a un autre.

V3 :
- orchestration plus continue de la file de traitement.

## 5. Conclusion

Le bon usage de ce document est de completer la vision par page :
- document par page = ou l'automatisation s'exerce ;
- document par workflow = ce qu'elle fait concretement dans le processus metier.
