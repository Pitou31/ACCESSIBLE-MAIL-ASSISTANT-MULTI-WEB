# Niveaux d'autonomie Browser Use

Date : 2026-03-21

## 1. Objet

Ce document formalise les niveaux d'autonomie accordables a `Browser Use`.

## 2. Principe

Le niveau d'autonomie ne doit jamais etre implicite.
Il doit etre :
- defini ;
- visible ;
- controle ;
- rattaché a une politique ;
- borné par les droits et la version produit.

## 3. Niveaux proposes

### Niveau 0 - Aucun Browser Use

Caracteristiques :
- aucune automatisation navigateur ;
- produit purement manuel assiste.

Correspondance :
- V1.

### Niveau 1 - Assistance gestuelle

Caracteristiques :
- Browser Use realise un geste unique ou tres court ;
- l'utilisateur garde l'initiative ;
- pas de sequence complexe.

Exemples :
- cliquer un bouton ;
- scroller jusqu'a une zone ;
- focus sur un champ.

Correspondance :
- debut V2.

### Niveau 2 - Navigation assistee

Caracteristiques :
- Browser Use enchaine quelques gestes bornes ;
- objectif unique ;
- interruption rapide et retour a l'utilisateur.

Exemples :
- ouvrir la boite et l'inbox ;
- ouvrir le mail prioritaire ;
- aller de la lecture a la trace IA.

Correspondance :
- coeur V2.

### Niveau 3 - Preparation assistee complete

Caracteristiques :
- Browser Use realise une sequence plus longue ;
- preparation quasi complete du travail ;
- validation humaine encore centrale.

Exemples :
- ouvrir le mail ;
- lire les zones utiles ;
- ouvrir la zone de reponse ;
- reinjecter le brouillon valide.

Correspondance :
- V2 avancee et debut V3.

### Niveau 4 - Automatisation gardee

Caracteristiques :
- Browser Use peut enchaîner plusieurs etapes metier ;
- politique explicite obligatoire ;
- journalisation stricte ;
- certaines actions finales peuvent etre permises selon cadre.

Exemples :
- traiter plusieurs mails avec supervision ;
- etiqueter et archiver selon regles ;
- envoi conditionnel autorise sur profils tres limites.

Correspondance :
- V3.

## 4. Repartition recommandee V2 V3

### V2

Niveaux autorises par defaut :
- niveau 1 ;
- niveau 2 ;
- niveau 3 partiel.

### V3

Niveaux autorises potentiels :
- niveau 3 complet ;
- niveau 4 sous conditions.

## 5. Actions sensibles

Certaines actions doivent toujours etre traitees comme sensibles :
- ouverture de session sur une boite ;
- lecture de certains contenus ;
- ouverture de pieces jointes ;
- injection dans le webmail ;
- envoi ;
- suppression ;
- archivage irreverible.

## 6. Regle de gouvernance

Plus le niveau d'autonomie monte :
- plus la politique doit etre explicite ;
- plus la trace doit etre detaillee ;
- plus les droits doivent etre stricts ;
- plus les garde-fous doivent etre forts.

## 7. Conclusion

La V2 et la V3 doivent etre vues comme des combinaisons de niveaux d'autonomie, pas comme deux blocs monolithiques.
