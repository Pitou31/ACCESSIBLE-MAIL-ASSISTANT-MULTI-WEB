# Vision globale V2 V3

Date : 2026-03-21

## 1. Objet

Ce document fixe la vision globale des versions V2 et V3 de l'application ACCESSIBLE-MAIL-ASSISTANT.

Il sert de reference produit et de cadre de developpement.

## 2. Point de depart

La V1 validee sait deja faire :
- gestion des comptes et des acces ;
- connexion Gmail OAuth ;
- creation de mail ;
- reponse aux mails ;
- traitement manuel ;
- traitement automatique ;
- sauvegardes securisees ;
- traitement des pieces jointes `txt`, `docx`, `pdf`.

La V2 et la V3 ne repartent donc pas de zero.
Elles ajoutent une couche d'automatisation navigateur au-dessus d'une base V1 deja fonctionnelle.

## 3. Intention generale

Le but n'est pas d'automatiser pour automatiser.
Le but est de reduire l'effort physique et cognitif des usagers, en particulier :
- les clics repetitifs ;
- les scrolls fatigants ;
- les deplacements du curseur ;
- les changements de zone dans la page ;
- les manipulations de webmail qui coutent beaucoup d'energie.

## 4. Difference fondamentale entre V2 et V3

La difference principale n'est pas le nombre de fonctionnalites.
La difference principale est le degre d'autonomie accorde a l'agent navigateur.

### V2

Definition :
- produit semi-automatise.

But :
- assister fortement ;
- garder l'humain au centre ;
- automatiser les gestes fatigants ;
- eviter les actions sensibles sans validation.

### V3

Definition :
- produit a automatisation avancee sous garde-fous.

But :
- deleguer davantage de manipulations navigateur ;
- orchestrer des sequences plus longues ;
- traiter une partie du workflow avec moins d'interruption humaine ;
- conserver des droits, politiques et traces stricts.

## 5. Role de Browser Use

`Browser Use` doit etre considere comme :
- un operateur navigateur ;
- un executeur de gestes ;
- un outil d'ouverture, de scroll, de clic, de navigation et d'injection.

`Browser Use` ne doit pas etre considere comme :
- le decideur metier principal ;
- le moteur de priorisation ;
- l'autorite d'envoi ;
- un agent libre sans cadre.

## 6. Repartition des responsabilites

Le systeme global doit rester separe en plusieurs couches :
- application locale :
  interface et regles produit ;
- backend :
  orchestration, droits, journalisation, politiques ;
- IA :
  analyse, generation, reformulation ;
- Browser Use :
  execution navigateur ;
- utilisateur humain :
  validation, arbitrage, supervision.

## 7. Positionnement produit de la V2

La V2 doit surtout :
- aider a atteindre la bonne zone ;
- aider a ouvrir le bon mail ;
- aider a scroller et a cliquer ;
- aider a reinjecter un brouillon valide ;
- aider a appliquer un profil de fonctionnement prudent.

La V2 ne doit pas encore generaliser :
- l'envoi automatique ;
- les boucles autonomes longues ;
- les chaines multi-messages sans supervision ;
- la suppression libre.

## 8. Positionnement produit de la V3

La V3 doit permettre :
- une navigation navigateur plus proactive ;
- des sequences plus longues ;
- l'execution de plusieurs etapes de traitement avec moins d'interruption ;
- une exploitation plus complete des policies d'automatisation ;
- une eventuelle ouverture a l'envoi conditionnel autorise.

## 9. Pages concernees

Pages principales de l'application :
- accueil ;
- compte ;
- parametres ;
- mails.

Strategie recommandee :
- automatisation legere sur accueil ;
- automatisation utile sur compte ;
- automatisation de pilotage sur parametres ;
- automatisation centrale et prioritaire sur mails.

## 10. Axes d'automatisation

Les automatisations V2/V3 se repartissent sur plusieurs axes :
- navigation dans l'application ;
- navigation dans le webmail ;
- lecture et deplacement dans le contenu ;
- ouverture du bon message ;
- gestion des pieces jointes ;
- generation et reinjection ;
- validation et action finale ;
- journalisation.

## 11. Conditions de reussite

La V2 et la V3 ne seront considerées comme reussies que si :
- elles reduisent effectivement les gestes et la fatigue ;
- elles conservent une bonne lisibilite pour l'utilisateur ;
- elles respectent les droits et les politiques ;
- elles n'affaiblissent pas la securite ;
- elles restent auditables.

## 12. Conclusion

La V2 et la V3 forment une trajectoire unique :
- V2 = assistance navigateur forte mais encadree ;
- V3 = automatisation navigateur plus autonome mais toujours gouvernee.

Le bon ordre est donc :
- documenter d'abord la cible complete ;
- developper ensuite progressivement ;
- verifier a chaque etape que le gain utilisateur reste le centre du projet.
