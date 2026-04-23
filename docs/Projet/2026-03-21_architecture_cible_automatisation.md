# Architecture cible de l'automatisation V2 V3

Date : 2026-03-21

## 1. Objet

Ce document decrit l'architecture cible de l'automatisation avec `Browser Use`.

## 2. Couches principales

### Frontend

Responsabilites :
- afficher les pages ;
- exposer les commandes V2/V3 ;
- montrer les statuts et les traces ;
- permettre a l'utilisateur de confirmer ou d'interrompre.

### Backend produit

Responsabilites :
- verifier les droits ;
- charger les politiques ;
- choisir le niveau d'automatisation ;
- orchestrer la sequence ;
- journaliser les sessions.

### IA

Responsabilites :
- analyser ;
- generer ;
- reformuler.

L'IA ne doit pas decider seule des actions navigateur finales.

### Browser Use

Responsabilites :
- executer les gestes navigateur ;
- suivre un plan d'execution ;
- remonter les resultats ou les echecs.

## 3. Objets techniques cibles

Objets deja introduits ou a stabiliser :
- `automation_policies`
- `browser_use_sessions`
- service d'orchestration navigateur ;
- adaptateur `Browser Use` reel ;
- journal V2/V3 cote interface.

## 4. Flux cible simplifie

1. l'utilisateur demande une action ou un workflow ;
2. le backend verifie :
   - session ;
   - droits ;
   - version produit ;
   - politique active ;
3. le backend construit un plan ;
4. `Browser Use` execute ce plan ;
5. le resultat est journalise ;
6. l'utilisateur reprend la main ou valide l'action suivante.

## 5. Difference d'architecture entre V2 et V3

### V2

Architecture pratique :
- plans courts ;
- actions unitaires ou petites sequences ;
- forte interaction avec l'utilisateur.

### V3

Architecture pratique :
- plans plus longs ;
- contexte plus riche ;
- orchestration plus continue ;
- gouvernance plus forte.

## 6. Placement recommande des responsabilites

Dans le frontend :
- boutons et feedbacks ;
- journal visible ;
- commandes utilisateur.

Dans le backend :
- politiques ;
- droits ;
- sessions ;
- plans d'execution ;
- audit.

Dans l'adaptateur Browser Use :
- traduction du plan produit en gestes navigateur reels.

## 7. Conclusion

La cle de l'architecture cible est de garder `Browser Use` comme executeur et non comme cerveau central du produit.
