# Plan Statistiques, Sauvegardes et Versions

Date : 2026-03-31
Projet : ACCESSIBLE_MAIL_ASSISTANT_MULTI

## 0. Décision de cadrage
À partir de maintenant, les pages `Accueil` et `Statistiques` ne doivent plus afficher de chiffres arbitraires ou décoratifs.

Tous les chiffres affichés devront être :
- calculés à partir de données réelles ;
- traçables ;
- datés ;
- rattachés à une période ;
- rattachés à une méthode de calcul stable.

En particulier, l'évaluation de la valeur de l'agent devra être basée sur :
- le nombre d'actions réellement effectuées ;
- le temps réellement passé ;
- la part manuelle, assistée, automatisée et automatique du travail ;
- la différence entre traitement sans IA, avec IA V1, avec IA V2 et avec IA V3.

---

# 1. Plan Statistiques

## 1.1 Objectif
Mesurer de manière sérieuse le gain réel apporté par l'agent, avec une attention particulière aux usages accessibles et aux efforts réellement demandés à l'usager.

L'objectif n'est pas d'afficher des "beaux chiffres", mais de répondre à des questions précises :
- combien d'actions l'usager doit-il encore faire lui-même ;
- combien de temps gagne-t-il réellement ;
- quelles étapes restent fatigantes ou complexes ;
- qu'est-ce qui est automatisé ;
- qu'est-ce qui reste seulement assisté ;
- qu'est-ce qui n'est pas encore pris en charge.

## 1.2 Principe de mesure
Les statistiques devront reposer sur des événements observables dans l'application.

### Double comptabilité obligatoire
Le système devra tenir plusieurs comptabilités en parallèle.

#### A. Comptabilité des actions
- nombre d'actions manuelles ;
- nombre d'actions assistées ;
- nombre d'actions automatisées ;
- nombre d'actions automatiques.

#### B. Comptabilité du temps
Deux temps distincts devront être suivis.

##### 1. Temps théorique
Temps de référence calculé à partir de standards de marché ou d'hypothèses stabilisées.
Exemples :
- temps théorique de saisie de x caractères ;
- temps théorique d'ouverture d'un mail ;
- temps théorique d'ajout d'une pièce jointe ;
- temps théorique de lecture/compréhension d'un message ;
- temps théorique de rédaction d'une réponse simple.

##### 2. Temps réel
Temps effectivement observé dans l'application pendant le traitement.

#### C. Séparation par mode de traitement
Les deux comptabilités ci-dessus devront être séparées selon deux grands modes.

##### 1. Traitement manuel des mails
Traitement réalisé principalement par l'usager, même si l'application apporte une aide.

##### 2. Traitement automatique des mails
Traitement réalisé avec déclenchements automatiques, automatisations ou workflows plus autonomes.

L'objectif est donc de pouvoir comparer :
- actions théoriques vs actions réelles ;
- temps théorique vs temps réel ;
- traitement manuel vs traitement automatique ;
- sans IA vs IA V1 vs IA V2 vs IA V3.

### Catégories d'actions à mesurer
1. Actions manuelles
- clics
- scrolls
- saisies clavier
- repositionnements du curseur
- sélections
- modifications manuelles
- rattachements de pièces jointes
- validations manuelles

2. Actions assistées par l'IA
- génération de brouillon
- reformulation
- résumé
- lecture audio
- aide dictionnaire
- détection de langue
- suggestions de correction

3. Actions automatisées
- classification
- priorité
- détection des langues d'entrée
- pré-remplissage
- détection de pièces jointes
- chargement automatique de contexte

4. Actions automatiques complètes
- récupération automatique du mail
- déclenchement automatique d'analyse
- détection d'insuffisance du contexte
- proposition automatique de précision
- exécution automatisée via Browser Use ou workflow avancé

## 1.3 Ce qu'il faut mesurer concrètement
### A. Temps
- temps théorique d'accès à la boîte mail
- temps réel d'accès à la boîte mail
- temps théorique d'ouverture d'un mail
- temps réel d'ouverture d'un mail
- temps théorique de compréhension du mail reçu
- temps réel de compréhension du mail reçu
- temps théorique de préparation de la réponse
- temps réel de préparation de la réponse
- temps théorique de génération du brouillon
- temps réel de génération du brouillon
- temps théorique de révision
- temps réel de révision
- temps théorique d'envoi
- temps réel d'envoi
- temps théorique total de traitement d'un mail
- temps réel total de traitement d'un mail

### B. Effort utilisateur
- nombre total de clics
- nombre de scrolls
- nombre d'actions clavier
- nombre de repositionnements dans le texte
- nombre de corrections manuelles
- nombre d'ouvertures de popup/outils
- nombre de validations intermédiaires

### C. Qualité de l'automatisation
- nombre d'actions supprimées grâce à l'IA
- nombre d'actions encore manuelles
- nombre d'actions semi-automatiques
- nombre d'actions entièrement automatiques
- nombre de retours arrière nécessaires
- nombre de corrections après génération IA

### D. Accessibilité réelle
- nombre d'usages de la lecture audio
- nombre d'usages de la dictée
- nombre d'usages du dictionnaire assisté
- nombre d'usages du mode guidé quand il existera
- temps gagné pour un usager ayant besoin d'aide à la lecture ou à la formulation

## 1.4 Événements à instrumenter dès maintenant
### Cycle boîte mail
- connexion à une boîte mail
- changement de boîte active
- rafraîchissement de la boîte
- ouverture d'un message
- passage création / réponse

### Cycle lecture / compréhension
- lecture audio démarrée
- lecture audio arrêtée
- langue détectée
- changement de voix
- test audio lancé

### Cycle rédaction
- génération du brouillon
- régénération
- édition manuelle
- ouverture du popup dictionnaire
- insertion/remplacement/suppression via dictionnaire
- dictée démarrée / arrêtée

### Cycle pièces jointes
- pièce jointe reçue détectée
- texte extrait d'une pièce jointe disponible
- pièce jointe ajoutée par l'opérateur
- pièce jointe mentionnée dans le texte de sortie
- pièce jointe absente alors qu'attendue

### Cycle validation / envoi
- contrôle avant envoi lancé
- alerte détectée
- brouillon validé
- mail envoyé
- mail mis en attente
- demande de précision nécessaire

## 1.5 Modèle de données statistiques
Créer une table ou collection d'événements de type :
- `event_id`
- `timestamp`
- `user_id`
- `account_id`
- `mailbox_id`
- `message_id`
- `workflow`
- `screen`
- `event_type`
- `event_subtype`
- `duration_ms`
- `manual_count`
- `assisted_count`
- `automated_count`
- `automatic_count`
- `metadata`

Exemples de `event_type` :
- `mailbox`
- `mail_open`
- `audio_read`
- `audio_input`
- `draft_generate`
- `dictionary_edit`
- `attachment_check`
- `send_validation`
- `send_mail`

## 1.6 Statistiques globales à afficher dans la sidebar > Statistiques
### Bloc 1. Activité
- nombre de mails ouverts
- nombre de mails traités
- nombre de brouillons générés
- nombre de réponses envoyées
- nombre de boîtes connectées

### Bloc 2. Effort utilisateur
- nombre moyen de clics par mail
- nombre moyen d'actions clavier par mail
- temps moyen de traitement par mail
- temps moyen avant première réponse

### Bloc 3. Automatisation
- part manuelle
- part assistée
- part automatisée
- part automatique

### Bloc 4. Accessibilité
- taux d'usage de la lecture audio
- taux d'usage de la dictée
- taux d'usage du dictionnaire
- taux d'usage des simplifications

## 1.7 Statistiques détaillées à afficher dans la sidebar > Statistiques
### Vue détaillée par période
- jour
- semaine
- mois

### Vue détaillée par boîte mail
- Gmail
- Outlook
- autre fournisseur

### Vue détaillée par workflow
- création
- réponse
- traitement automatique
- validation

### Vue détaillée par langue
- langue d'entrée détectée
- langue de sortie choisie
- répartition des langues réellement traitées

### Vue détaillée par accessibilité
- lecture audio
- dictée
- dictionnaire
- niveau d'assistance
- vitesse de lecture

### Vue détaillée par qualité
- nombre de brouillons retouchés
- nombre de validations sans retouche
- nombre de cas ambigus
- nombre de pièces jointes manquantes
- nombre de mails insuffisants

## 1.8 Étude comparative sérieuse : sans IA / IA V1 / IA V2 / IA V3
Le comparatif ne doit pas être théorique. Il doit être basé sur un protocole de mesure stable.

### Règle
Pour un même scénario métier, mesurer :
- le temps théorique total ;
- le temps réel total ;
- le nombre théorique d'actions ;
- le nombre réel d'actions manuelles ;
- le nombre réel d'actions assistées ;
- le nombre réel d'actions automatisées ;
- le nombre réel d'actions automatiques ;
- le niveau de fatigue ou complexité restante ;
- le nombre d'erreurs évitées ;
- le nombre de corrections nécessaires.

### Définition provisoire des versions
- Sans IA : traitement entièrement manuel, hors application assistée.
- IA V1 : agent actuel de production assistée, sans automatisation complète par navigateur.
- IA V2 : automatisation partielle avec Browser Use / navigation assistée.
- IA V3 : automatisation avancée, déclenchements plus autonomes, contrôles et aides renforcés.

## 1.9 Tableau comparatif de référence
| Critère | Sans IA | IA V1 | IA V2 | IA V3 |
|---|---:|---:|---:|---:|
| Accès à la boîte mail | Manuel | Manuel | Assisté | Automatique partiel |
| Ouverture du bon mail | Manuel | Manuel assisté | Assisté | Automatique partiel |
| Lecture / compréhension | Manuel | Assisté audio + IA | Assisté avancé | Assisté avancé |
| Détection de langue | Manuel | Automatique entrée | Automatique | Automatique |
| Détection d'insuffisance | Manuel | Non / partiel | Assisté | Automatique |
| Détection de règles utiles | Manuel | Partiel | Assisté | Automatique partiel |
| Génération de brouillon | Non | Oui | Oui | Oui |
| Corrections manuelles | Très fortes | Moyennes | Faibles | Très faibles |
| Vérification avant envoi | Manuelle | Partielle | Assistée | Automatique assistée |
| Pièces jointes | Manuelles | Partielles | Assistées | Contrôlées automatiquement |
| Actions manuelles réelles | À mesurer | À mesurer | À mesurer | À mesurer |
| Actions automatiques réelles | 0 | À mesurer | À mesurer | À mesurer |
| Temps théorique total | À mesurer | À mesurer | À mesurer | À mesurer |
| Temps réel total | À mesurer | À mesurer | À mesurer | À mesurer |
| Écart temps théorique / réel | À mesurer | À mesurer | À mesurer | À mesurer |
| Traitement manuel | Total | Majoritaire | Mixte | Minoritaire |
| Traitement automatique | Nul | Faible | Partiel | Fort |
| Fatigue cognitive | Élevée | Réduite | Plus réduite | Minimisée |

## 1.10 Campagne de mesure à lancer
Il faut créer un protocole de tests comparatifs sur des cas réels ou semi-réels.

### Cas à couvrir
1. Mail simple sans pièce jointe.
2. Mail avec pièce jointe nécessaire.
3. Mail ambigu nécessitant précision.
4. Mail multilingue.
5. Mail nécessitant règle métier.
6. Mail non automatisable.
7. Mail urgent.

### Mesures à relever pour chaque cas
- nombre de clics
- nombre de scrolls
- nombre d'actions clavier
- temps total
- nombre de corrections
- nombre d'outils ouverts
- nombre d'alertes utiles
- résultat final acceptable ou non

## 1.11 Première décision de mise en œuvre
Avant de développer l'affichage final des statistiques, instrumenter d'abord la collecte des événements dans les workflows `Créer un mail` et `Répondre au mail`.

C'est la condition pour remplacer les chiffres fictifs de l'accueil et de la page Statistiques.

---

# 2. Plan Sauvegardes

## 2.1 Objectif
Transformer la page `Sauvegardes` en page utile et vérifiable, et non plus en page d'intention.

## 2.2 Informations à afficher
### Sauvegardes globales
- dernière sauvegarde interne
- dernière sauvegarde externe
- état de validité
- taille
- date
- nombre de sauvegardes conservées
- règle de rotation active

### Historique
Pour chaque sauvegarde :
- nom
- date
- emplacement
- taille
- type : interne / externe
- statut : valide / incomplète / erreur

## 2.3 Fonctions à prévoir
- afficher l'historique réel
- lancer une sauvegarde manuelle
- vérifier qu'une sauvegarde interne et externe existent bien en paire
- signaler une rotation incomplète
- signaler une erreur de nettoyage

## 2.4 Point important
Le système actuel de sauvegarde existe déjà. La page sidebar correspondante doit maintenant devenir un miroir fiable de cet état réel.

---

# 3. Plan Versions

## 3.1 Objectif
Transformer la page `Versions` en feuille de route de produit réellement exploitable.

## 3.2 Ce que la page doit montrer
### Vision générale
- V1 : agent de production assisté
- V2 : automatisation partielle
- V3 : automatisation avancée

### Pour chaque version
- objectifs
- fonctions incluses
- fonctions absentes
- statut de maturité
- dépendances restantes

## 3.3 Vue attendue
Pour chaque version, distinguer :
- fait
- en cours
- à faire
- bloqué

## 3.4 Lien avec les priorités actuelles
### V1 prioritaire
Terminer un premier agent de production comprenant :
- flux mail stable
- règles stables
- accessibilité réelle
- audio stable
- sauvegardes fiables
- boîtes mail utilisables

### V2 ensuite
- Browser Use
- automatisations partielles
- réduction forte des actions manuelles

### V3 enfin
- détection proactive des insuffisances
- assistance décisionnelle avancée
- automatisation plus autonome

---

# 4. Ordre de travail recommandé
1. Instrumenter les événements nécessaires aux statistiques.
2. Remplacer les chiffres fictifs de l'accueil et de la page Statistiques.
3. Construire la page Statistiques réelle.
4. Construire la page Sauvegardes réelle à partir du système existant.
5. Transformer la page Versions en roadmap produit vivante.

---

# 5. Point d'attention majeur
Le comparatif `sans IA / IA V1 / IA V2 / IA V3` doit être basé sur des mesures observées et non sur des estimations marketing.

C'est particulièrement important pour un produit pensé aussi pour des personnes handicapées :
- le vrai gain n'est pas seulement du temps ;
- c'est aussi la réduction de charge cognitive ;
- la diminution du nombre d'actions nécessaires ;
- la réduction du risque d'erreur ;
- la simplification du parcours.
