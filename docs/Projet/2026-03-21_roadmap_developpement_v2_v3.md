# Roadmap de developpement V2 V3

Date : 2026-03-21

## 1. Objet

Ce document transforme la vision V2/V3 en feuille de route concrete.

## 2. Phase 0 - Documentation complete

Objectif :
- figer la vision avant le code.

Livrables :
- vision globale ;
- inventaires par page et par workflow ;
- niveaux d'autonomie ;
- garde-fous ;
- architecture cible ;
- roadmap.

Ajout validé :
- formalisation du contrôle de complétude du contexte avant réponse IA ;
- formalisation du rôle futur de la page `Règles`.

## 3. Phase 1 - Base technique d'orchestration

Objectif :
- poser le socle backend sans brancher tout le moteur reel.

Livrables :
- politiques d'automatisation ;
- sessions navigateur ;
- endpoints de pilotage ;
- plans d'execution prepares.

## 4. Phase 1 bis - Saisie audio

Objectif :
- réduire la fatigue d'entrée texte avant toute automatisation avancée.

Travaux :
- ajouter la saisie audio sur les zones éditables prioritaires ;
- afficher les états du micro ;
- permettre l'insertion au curseur ou sur sélection ;
- ajouter un premier réglage dans la page `Paramètres`.

## 5. Phase 1 ter - Contrôle de complétude et page Règles

Objectif :
- sécuriser la logique de réponse avant Browser Use.

Travaux :
- rendre la page `Règles` exploitable ;
- transmettre systématiquement les règles au prompt ;
- imposer une étape d'évaluation de suffisance du contexte ;
- permettre une sortie prudente ou une demande de complément au lieu d'une réponse forcée.

## 6. Phase 2 - V2 Sprint 1

Objectif :
- premiere valeur visible et utile.

Cible :
- page mails ;
- page parametres.

Fonctions :
- ouvrir la boite ;
- ouvrir le mail prioritaire ;
- guider vers les zones utiles ;
- injecter le brouillon valide ;
- activer un mode V2 prudent.

## 7. Phase 3 - V2 Sprint 2

Objectif :
- enrichir l'assistance navigateur.

Cible :
- meilleure reprise de contexte ;
- commandes de lecture et de deplacement plus nombreuses ;
- extension partielle vers compte.

## 8. Phase 4 - V2 stabilisation

Objectif :
- tester ;
- durcir ;
- mesurer le gain utilisateur.

Travaux :
- tests fonctionnels ;
- verifications de securite ;
- ajustements UX ;
- validation des garde-fous.

## 9. Phase 5 - Ouverture V3

Objectif :
- monter progressivement en autonomie.

Travaux :
- plans plus longs ;
- file multi-messages ;
- politiques plus fines ;
- actions de workflow plus larges.

## 10. Phase 6 - V3 avancee

Objectif :
- automatisation poussee sous supervision et gouvernance.

Travaux :
- orchestration continue ;
- enchainement de plusieurs messages ;
- integrations plus riches avec le webmail ;
- eventuel envoi conditionnel.

## 11. Regle de priorisation

Toujours prioriser dans cet ordre :
1. gain utilisateur concret
2. securite
3. lisibilite du comportement
4. acceleration de traitement

## 12. Conclusion

La roadmap recommande :
- documentation d'abord ;
- V2 utile et prudente ensuite ;
- V3 seulement apres validation des bases.
