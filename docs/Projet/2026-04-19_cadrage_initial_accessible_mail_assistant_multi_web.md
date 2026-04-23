# Cadrage initial `ACCESSIBLE_MAIL_ASSISTANT_MULTI_WEB`

## 1. Objet du document

Ce document fixe le cadrage initial de la future version Web nommée `ACCESSIBLE_MAIL_ASSISTANT_MULTI_WEB`.

Cette future application n'est pas lancée immédiatement comme chantier de migration complet. Elle sera créée lorsque la version locale actuelle aura atteint un niveau de couverture fonctionnelle jugé suffisant.

## 2. Rôle de `ACCESSIBLE_MAIL_ASSISTANT_MULTI_WEB`

`ACCESSIBLE_MAIL_ASSISTANT_MULTI_WEB` devra remplir simultanément quatre rôles :

1. servir de base de migration vers une version Web exploitable
2. devenir le référentiel de maintenance avant production
3. servir de plateforme de test et validation pré-production
4. être hébergée sur un sous-domaine distinct du site de production

Autrement dit, cette version Web ne sera pas seulement une copie déployée. Elle deviendra le point d'entrée de référence pour les évolutions, les validations et les essais avant mise en production.

## 3. Décision de séquencement

La migration Web n'est pas le chantier immédiatement prioritaire.

Le séquencement retenu est le suivant :

1. continuer à compléter et stabiliser l'application locale actuelle
2. finaliser les fonctions encore manquantes ou insuffisamment mûres
3. préparer ensuite l'environnement `ACCESSIBLE_MAIL_ASSISTANT_MULTI_WEB`
4. basculer progressivement la maintenance et la préparation de production vers cette nouvelle base

## 4. Principe directeur

Tant que le périmètre métier n'est pas suffisamment stabilisé, la version locale actuelle reste la base de développement fonctionnel.

La future version Web devra être construite sur des bases plus propres en matière de portabilité, d'exploitation et de dépendances techniques, afin d'éviter de transposer à l'identique des mécanismes locaux spécifiques au Mac ou au Spark.

## 5. Ce que devra contenir la future version Web

La future version `ACCESSIBLE_MAIL_ASSISTANT_MULTI_WEB` devra reprendre le coeur fonctionnel de l'application :

- gestion multi-comptes et multi-boîtes mail
- rédaction, réponse, résumé, reformulation, traduction
- traitement assisté des pièces jointes
- règles et aides au traitement
- flux d'utilisation accessibles
- fonctions audio utiles à la lecture et à la dictée

Elle devra cependant le faire dans un cadre Web portable, compatible avec un hébergement de type site Web.

## 6. Ce qui ne devra pas être repris tel quel

Les éléments suivants ne devront pas être transférés tels quels dans la cible Web :

- modèles IA locaux dépendants d'Ollama
- scripts d'exploitation spécifiques au Spark
- mécanismes de déploiement reposant sur `ssh`, `systemctl`, tunnels locaux et procédures manuelles serveur
- dépendances implicites à des chemins absolus Mac ou Spark
- dépendances techniques locales non garanties sur un hébergement Web standard

## 7. Décisions déjà prises pour la cible Web

### 7.1 IA

Les modèles locaux ne devront pas être transférés vers la cible Web.

La cible Web devra s'appuyer sur une API distante, avec `Together` comme orientation principale.

Les modèles locaux resteront uniquement pertinents pour les environnements locaux de développement, test ou expérimentation.

### 7.2 Audio

L'audio ne doit pas être abandonné.

Les fonctions liées à la lecture et à la dictée devront être conservées dans la version Web. En revanche, elles devront être repensées pour une architecture compatible avec une application Web et un hébergement distant.

### 7.3 Exploitation

Les scripts Spark et les scripts d'exploitation Mac/Spark devront rester hors du coeur applicatif.

Ils ne doivent plus être considérés comme des composants fonctionnels de la future application Web.

### 7.4 Configuration

La future version Web devra reposer sur une configuration de production propre :

- URLs publiques réelles
- callbacks OAuth adaptés au domaine Web
- séparation claire des environnements
- configuration sans `localhost` câblé en dur comme hypothèse principale

## 8. Fonctionnalités encore à compléter avant lancement du chantier Web

Le chantier `ACCESSIBLE_MAIL_ASSISTANT_MULTI_WEB` ne devra être ouvert qu'après maturation suffisante de la version locale.

Exemples de sujets encore à finaliser ou à stabiliser :

- comptabilité
- complétude fonctionnelle globale
- stabilisation des workflows métier
- validation des parcours audio
- consolidation des fonctions d'assistance IA

## 9. Résultat attendu à terme

Lorsque le moment sera venu, `ACCESSIBLE_MAIL_ASSISTANT_MULTI_WEB` devra devenir :

- la base propre de migration
- la plateforme de maintenance continue
- la plateforme de validation pré-production
- le support de préparation à la mise en production réelle

## 10. Règle de gouvernance provisoire

Jusqu'à l'ouverture effective du chantier Web :

- l'application locale actuelle reste la base active de développement métier
- les décisions d'architecture Web sont préparées, mais non encore industrialisées
- aucun transfert massif ne doit être lancé avant stabilisation fonctionnelle suffisante

## 11. Étape suivante au moment opportun

Lorsque la version locale sera jugée suffisamment aboutie, il faudra alors produire un second document de cadrage opérationnel couvrant :

1. l'architecture cible de `ACCESSIBLE_MAIL_ASSISTANT_MULTI_WEB`
2. la stratégie IA distante (`Together`)
3. la stratégie audio Web compatible hébergement
4. le nettoyage des dépendances machine
5. le plan de migration depuis la base locale

