# Inventaire des automatisations V2 V3 par page

Date : 2026-03-21

## 1. Objet du document

Ce document formalise les automatisations possibles par page a partir de l'existant V1.

Le principe retenu est le suivant :
- la V2 correspond a une automatisation minimale mais utile ;
- la V3 correspond a une automatisation maximale sous garde-fous ;
- la difference entre V2 et V3 depend surtout du degre d'autonomie accorde a l'agent navigateur ;
- `Browser Use` est considere comme un operateur navigateur capable de deplacer le curseur, scroller, cliquer, ouvrir une zone, injecter un texte ou se repositionner dans la page.

## 2. Regle generale de distinction entre V2 et V3

### V2

Objectif :
- reduire la fatigue sans retirer le controle a l'utilisateur.

Caracteristiques :
- automatisation partielle ;
- aide au deplacement dans la page ;
- aide au scroll et aux clics ;
- aide a l'ouverture des bonnes zones ;
- injection possible d'un brouillon valide ;
- validation humaine centrale avant toute action sensible.

### V3

Objectif :
- deleguer une grande partie de la manipulation navigateur a l'agent.

Caracteristiques :
- automatisation etendue ;
- navigation proactive ;
- enchainement de plusieurs actions navigateur ;
- orchestration plus autonome de workflows complets ;
- envoi possible seulement si la politique, les droits et les garde-fous le permettent.

## 3. Pages retenues

Pages ciblees dans l'existant :
- page d'accueil : `frontend/index.html`
- page compte : `frontend/account.html`
- page parametres : `frontend/settings.html`
- page mails : `frontend/mail.html`

## 4. Tableau d'inventaire

| Page | Role actuel dans la V1 | Automatisation minimale V2 | Exemple concret V2 a partir de l'existant | Automatisation maximale V3 | Exemple concret V3 a partir de l'existant |
|---|---|---|---|---|---|
| Page d'accueil | Orienter l'utilisateur et presenter la solution | Reprise de contexte, mise en focus automatique, clic assiste vers la bonne page | Si l'utilisateur a deja une session active, Browser Use ouvre directement la page `Compte` ou `Gestion des mails` au lieu de lui laisser refaire toute la navigation depuis l'accueil | Redirection intelligente et ouverture proactive du bon workflow | Si une boite est deja connectee et qu'une campagne de traitement automatique est en attente, Browser Use quitte l'accueil et ouvre directement `mail.html` sur la bonne zone de travail |
| Page compte | Se connecter, verifier le statut, changer le mot de passe, ouvrir un compte | Saisie guidee, clics assistes, repositionnement automatique sur les champs utiles | Browser Use place le curseur dans `Adresse email`, puis dans `Mot de passe`, puis clique `Se connecter` ; il peut aussi amener l'utilisateur sur `Verifier mon statut` sans recherche manuelle | Parcours quasi complet de gestion de compte | Browser Use detecte qu'aucune session n'est active, choisit la bonne action, remplit le type de compte connu, positionne le curseur sur le bon champ restant et declenche la verification d'etat ou la connexion |
| Page parametres | Regler affichage, accessibilite, assistance IA et comportement metier | Scroll assiste, ouverture du bon bloc, clic assiste sur les options importantes, sauvegarde guidee | Browser Use scrolle directement vers `Gestion des mails`, active `Simulation d'envoi`, laisse `Validation obligatoire avant envoi` cochee et ouvre l'aperçu si l'utilisateur veut voir le rendu | Configuration intelligente de profils et politiques d'automatisation | Browser Use applique automatiquement un profil de confort moteur, regle la lecture progressive, active la generation automatique, puis configure un profil V2 ou V3 par boite selon les droits |
| Page mails | Connecter la boite, afficher l'inbox, lire, analyser, generer et traiter | Navigation assistee dans la boite, ouverture du bon mail, scroll dans le contenu, ouverture de la zone de reponse, injection du brouillon valide | Browser Use clique `Connecter la boîte mail`, puis `Rafraîchir l'Inbox`, ouvre le message prioritaire, scrolle jusqu'au contenu utile, affiche la trace IA puis injecte le brouillon valide dans la bonne zone | Orchestration navigateur quasi complete du traitement mail | Browser Use ouvre l'inbox, filtre ou parcourt les messages, ouvre les mails prioritaires, collecte le contexte visible, prepare ou reinjecte la reponse, change les etiquettes, archive ou envoie selon la politique active |

## 5. Detail par page

## 5.1 Page d'accueil

### Role actuel

La page d'accueil est surtout une page d'orientation et de presentation.
Elle ne porte pas le traitement metier principal, mais elle peut eviter une fatigue initiale inutile.

### Existant concret

On y trouve notamment :
- une presentation generale du produit ;
- des sections d'information ;
- une sidebar de navigation ;
- une fonction de point d'entree vers les autres pages.

### V2 minimale

Automatisations recommandees :
- mise en focus automatique sur la sidebar ou sur l'action principale ;
- clic assiste vers la page la plus utile ;
- reprise du dernier contexte connu.

Exemples concrets :
- si l'utilisateur sort d'une session de traitement, Browser Use peut ouvrir directement `Gestion des mails` ;
- si aucune session n'est active, Browser Use peut orienter d'abord vers `Compte` ;
- si l'utilisateur est deja connecte, il n'a pas besoin de repasser manuellement par plusieurs clics dans la navigation.

### V3 maximale

Automatisations recommandees :
- contournement quasi systematique de la page d'accueil quand elle n'est pas utile ;
- determination du meilleur point d'entree selon l'etat du compte, de la boite et du workflow ;
- lancement direct du workflow du jour.

Exemples concrets :
- session active + boite connectee + mails en attente : ouverture automatique de `mail.html` ;
- pas de session active : ouverture de `account.html` ;
- campagne automatique deja lancee : retour direct sur la zone `Arrêter le traitement automatique` et sur le contexte de campagne.

## 5.2 Page compte

### Role actuel

Cette page est la porte d'entree fonctionnelle :
- connexion ;
- verification de statut ;
- deconnexion ;
- changement de mot de passe ;
- acces a la demande d'ouverture de compte.

### Existant concret

Elements importants presents :
- `Type de compte`
- `Adresse email`
- `Mot de passe`
- bouton `Mot de passe oublié`
- bouton `Verifier mon statut`
- bouton `Se connecter`
- bouton `Se deconnecter`
- bloc `Changer mon mot de passe`
- lien `Ouvrir un compte`

### V2 minimale

Automatisations recommandees :
- focus automatique sur le premier champ utile ;
- passage automatique au champ suivant ;
- clic assiste sur les bons boutons ;
- retour guide vers les messages de feedback et cartes de statut.

Exemples concrets :
- Browser Use positionne le curseur dans `Adresse email`, puis dans `Mot de passe`, puis clique `Se connecter` ;
- apres une connexion, il scrolle automatiquement jusqu'a `Aucune session active` ou au bloc de statut pour montrer le resultat ;
- pour un utilisateur qui veut juste savoir si son compte est pret, Browser Use clique `Verifier mon statut` apres saisie minimale.

### V3 maximale

Automatisations recommandees :
- parcours plus complet selon le contexte detecte ;
- choix semi-automatique de l'action la plus pertinente ;
- aide plus autonome a la gestion de compte.

Exemples concrets :
- Browser Use detecte que l'utilisateur est deja connecte et l'evite de resaisir ses identifiants ;
- s'il manque seulement le `Type de compte`, il positionne directement le curseur sur ce champ plutot que de repartir du debut ;
- en cas de demande de changement de mot de passe, il navigue automatiquement jusqu'au bloc `Changer mon mot de passe`.

## 5.3 Page parametres

### Role actuel

La page parametres est deja la meilleure candidate pour piloter les niveaux d'automatisation.

Elle porte plusieurs familles de reglages :
- affichage ;
- accessibilite ;
- assistance IA ;
- gestion des mails.

### Existant concret

Elements deja presents et directement exploitables :
- `Ouvrir l’aperçu`
- `Vitesse de scroll`
- `Quantité affichée à chaque étape`
- `Lecture progressive activée`
- `Modèle IA par défaut`
- `Niveau d’assistance`
- `Génération`
- `Gestion des pièces jointes`
- `Simulation d’envoi activée`
- `Validation obligatoire avant envoi`
- `Brouillon automatique`

### V2 minimale

Automatisations recommandees :
- scroll automatique vers la bonne section ;
- clic assiste sur les options importantes ;
- aide a la configuration d'un mode prudent ;
- creation d'un profil V2 securise.

Exemples concrets :
- Browser Use scrolle directement vers `Gestion des mails` au lieu de demander a l'utilisateur de traverser toute la page ;
- il laisse `Simulation d'envoi activée` et `Validation obligatoire avant envoi` actifs ;
- il peut activer `Brouillon automatique` et `Génération automatique` si l'utilisateur veut une assistance plus forte sans aller jusqu'a l'envoi auto ;
- il peut regler `Vitesse de scroll` et `Lecture progressive activée` pour reduire l'effort physique.

### V3 maximale

Automatisations recommandees :
- pilotage avance de profils complets ;
- configuration differenciee selon utilisateur, boite et niveau autorise ;
- pilotage de la future politique `Browser Use`.

Exemples concrets :
- Browser Use applique un profil `semi_automatisé` ou `automatisation avancée` selon le `product_version` ;
- il prepare automatiquement une combinaison de reglages de lecture, de vitesse, de validation et de generation ;
- il devient possible de piloter depuis cette page l'activation de fonctions comme :
  - navigation inbox automatisee ;
  - ouverture automatique du mail cible ;
  - reinjection automatique du brouillon ;
  - envoi conditionnel autorise ou non.

## 5.4 Page mails

### Role actuel

La page mails est la page la plus strategique pour `Browser Use`.
C'est la page ou le gain de fatigue motrice sera le plus important.

### Existant concret

Elements deja presents et directement exploitables :
- choix `Créer un mail` / `Répondre au mail`
- badges `Classification` et `Priorité`
- select `LLM utilisé`
- bloc `Connexion à la boîte mail`
- champ `Adresse de la boîte mail`
- bouton `Connecter la boîte mail`
- bouton `Rafraîchir l'Inbox`
- bouton `Lancer le traitement automatique`
- bouton `Arrêter le traitement automatique`
- zone `Connexions enregistrées`
- zone `Inbox connectée`
- champs de creation de mail
- champ `Prompt guidé`
- gestion des pieces jointes
- bouton `Generer le brouillon`
- zone de contenu editable
- trace de ce qui est envoye a l'IA dans le workflow existant

### V2 minimale

Automatisations recommandees :
- ouverture guidee de la boite ;
- clic assiste sur `Rafraîchir l'Inbox` ;
- selection guidee du bon message ;
- scroll automatique dans le message ;
- ouverture de la zone utile pour lire ou repondre ;
- injection assistee du brouillon deja valide.

Exemples concrets :
- Browser Use clique `Connecter la boîte mail`, puis guide l'utilisateur dans la connexion fournisseur ;
- une fois la boite connectee, il clique `Rafraîchir l'Inbox` ;
- il ouvre le message le plus prioritaire dans `Inbox connectée` ;
- il scrolle jusqu'au corps du mail ou jusqu'aux pieces jointes detectees ;
- apres generation, il place le curseur dans `Contenu éditable` ou dans la zone de reponse adaptee ;
- si un brouillon est valide, il peut le reinjecter dans le webmail sans que l'utilisateur ait a refaire tous les clics et scrolls.

### V3 maximale

Automatisations recommandees :
- navigation navigateur presque complete dans le webmail ;
- enchainement de plusieurs actions sans micro-guidage permanent ;
- traitement d'une file de messages ;
- reinjection et operations de workflow plus larges.

Exemples concrets :
- Browser Use ouvre successivement plusieurs mails non traites et prioritaires ;
- il change de dossier, revient a l'inbox, scrolle, ouvre un autre message ;
- il recupere les elements visibles utiles avant appel IA ;
- il prepare ou reinjecte plusieurs brouillons ;
- il applique des actions de workflow comme etiquetage, archivage ou changement d'etat ;
- si la politique l'autorise un jour, il peut aller jusqu'a l'envoi reel avec journalisation complete.

## 6. Recommandation de repartition entre V2 et V3

### Ce qu'il faut privilegier en V2

La V2 doit surtout automatiser :
- la navigation de base ;
- les clics repetitifs ;
- les scrolls fatigants ;
- l'ouverture des bons panneaux ;
- la reinjection d'un brouillon deja valide.

Pages les plus importantes en V2 :
- page parametres ;
- page mails.

### Ce qu'il faut reserver principalement a la V3

La V3 doit porter :
- l'enchainement de plusieurs actions navigateur ;
- la navigation proactive dans le webmail ;
- le traitement de plusieurs messages a la suite ;
- la coordination plus autonome entre analyse, brouillon, reinjection et actions de file.

La page centrale de la V3 sera donc surtout :
- la page mails.

## 7. Conclusion pratique

Le choix entre V2 et V3 ne doit pas se faire par nombre de pages automatisees seulement.
Il doit surtout se faire selon la question suivante :

Quel degre d'autonomie veut-on confier a l'agent navigateur ?

En pratique :
- V2 = l'agent aide l'utilisateur a faire moins de gestes ;
- V3 = l'agent fait lui-meme une grande partie des gestes autorises.

Pour l'existant, la meilleure trajectoire semble etre :
- V2 : automatisation legere sur accueil et compte, automatisation utile sur parametres, automatisation forte mais encadree sur mails ;
- V3 : automatisation massive concentree principalement sur mails, avec parametres comme centre de pilotage des politiques.
