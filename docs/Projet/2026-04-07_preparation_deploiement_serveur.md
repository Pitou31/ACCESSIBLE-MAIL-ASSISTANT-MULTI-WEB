# Preparation d'une version serveur

Date : 2026-04-07

## 1. Objectif

Identifier ce qu'il faut prevoir pour heberger Accessible Mail Assistant sur un serveur, au-dela de l'usage local Mac ou Windows.

Cette note ne fixe pas encore un choix d'hebergeur. Elle liste les contraintes, besoins, risques, donnees sensibles, ressources et postes de cout.

## 2. Scenarios d'hebergement possibles

### 2.1 Serveur local chez l'utilisateur ou dans une association

Avantages :
- meilleure maitrise des donnees ;
- cout recurrent potentiellement limite ;
- possible usage de LLM locaux ;
- pas de mutualisation externe.

Contraintes :
- maintenance materielle ;
- sauvegardes a organiser ;
- securite reseau a gerer ;
- performances variables selon machine.

### 2.2 VPS ou serveur cloud classique

Avantages :
- deploiement plus simple ;
- acces distant ;
- sauvegardes et supervision plus faciles ;
- cout previsible.

Contraintes :
- LLM local difficile sans GPU ;
- donnees hebergees chez un tiers ;
- besoin de securiser HTTPS, sessions, secrets, base.

### 2.3 Serveur GPU dedie

Avantages :
- LLM local et STT local plus realistes ;
- latence meilleure pour fonctions IA residentes ;
- reduction possible des appels API.

Contraintes :
- cout plus eleve ;
- administration plus complexe ;
- besoin de supervision GPU ;
- capacite a dimensionner selon nombre d'utilisateurs.

### 2.4 DGX Spark ou poste IA dedie

Avantages :
- tres pertinent pour tester Gemma 4, Qwen, Mistral plus gros ;
- bon candidat pour fonctions locales avancees ;
- meilleure autonomie sur l'IA.

Contraintes :
- a evaluer en conditions reelles ;
- consommation electrique et maintenance ;
- sauvegarde et securisation reseau indispensables.

Document dedie :
- `docs/Projet/2026-04-07_installation_locale_dgx_spark_pilotee_depuis_mac.md`

## 3. Architecture cible minimale

Composants :
- reverse proxy HTTPS ;
- backend Node.js ;
- frontend servi par le backend ou par serveur statique ;
- base de donnees ;
- stockage temporaire pieces jointes/audio ;
- fournisseur LLM local ou API ;
- fournisseur dictée local ou API ;
- SMTP / Gmail OAuth ;
- systeme de logs ;
- sauvegardes.

En production multi-utilisateur, il faudra probablement sortir de SQLite et passer a une base serveur plus robuste, par exemple PostgreSQL.

## 4. Securite reseau

Obligatoire :
- HTTPS ;
- redirection HTTP vers HTTPS ;
- pare-feu ;
- ports exposes limites ;
- aucun acces direct a la base ;
- aucun secret dans le code ;
- secrets stockes dans variables d'environnement ou coffre de secrets ;
- mises a jour systeme regulieres.

Recommande :
- reverse proxy type Nginx ou Caddy ;
- certificat automatique Let's Encrypt ;
- rate limiting sur les routes sensibles ;
- taille maximale des uploads ;
- journalisation des erreurs sans contenu sensible ;
- separation environnement test / production.

## 5. Authentification et sessions

Points a renforcer avant vraie production :
- secret de session fort ;
- expiration de session ;
- cookies `HttpOnly`, `Secure`, `SameSite` ;
- protection CSRF si formulaires/session cookies ;
- limitation des tentatives de connexion ;
- reinitialisation de mot de passe securisee ;
- droits par role ;
- verification serveur de toutes les pages privees.

## 6. Protection des donnees

Donnees sensibles possibles :
- contenus de mails ;
- adresses e-mail ;
- pieces jointes ;
- transcriptions vocales ;
- commandes vocales ;
- brouillons generes ;
- jetons OAuth Gmail ;
- cles API ;
- statistiques d'usage.

Mesures minimales :
- chiffrer les communications ;
- limiter la duree de conservation des fichiers temporaires ;
- ne pas loguer le contenu complet des mails par defaut ;
- chiffrer ou proteger fortement les secrets ;
- sauvegardes chiffrees ;
- controle d'acces par utilisateur ;
- separation des donnees par compte ou organisation.

## 7. RGPD et conformite

Pour une mise a disposition reelle :
- definir le responsable de traitement ;
- definir les finalites ;
- informer l'utilisateur ;
- documenter les sous-traitants IA, hebergeur, e-mail, STT ;
- prevoir suppression/export des donnees ;
- prevoir durees de conservation ;
- verifier l'hebergement UE si necessaire ;
- signer les contrats de sous-traitance ou DPA avec les fournisseurs ;
- tenir un registre simple des traitements.

Point particulier :
- envoyer un mail ou un audio a une API externe est un transfert de donnee a encadrer.

Document dedie :
- `docs/Projet/2026-04-07_integration_rgpd_installation_locale_et_serveur.md`

## 8. IA locale ou API

### API

Avantages :
- qualite souvent meilleure ;
- pas besoin de GPU ;
- maintenance modele deleguee.

Contraintes :
- cout a l'usage ;
- latence reseau ;
- dependance fournisseur ;
- donnees transmises a l'exterieur ;
- besoin de clauses contractuelles.

### IA locale

Avantages :
- meilleure confidentialite ;
- cout marginal par requete plus faible apres investissement ;
- possibilite de modele resident pour edition vocale.

Contraintes :
- besoin CPU/RAM/GPU ;
- modeles a maintenir ;
- latence variable ;
- supervision des ressources.

Decision provisoire :
- Mistral local est exploitable sur Mac pour certains usages ;
- Gemma 4 26B n'est pas exploitable confortablement sur Mac dans l'application ;
- Gemma 4 et modeles plus lourds a retester sur DGX Spark ou serveur GPU.

## 9. Dictée et audio

Options :
- API Deepgram ;
- API AssemblyAI ;
- transcription locale whisper.cpp ;
- autre STT local plus tard.

Contraintes :
- le live STT exige une bonne stabilite reseau ou une bonne capacite locale ;
- l'audio est une donnee sensible ;
- les sessions live doivent etre nettoyees proprement ;
- il faut prevoir timeouts, relance ou arret propre.

Pour production :
- limiter taille et duree des chunks ;
- tracer les erreurs techniques sans stocker l'audio complet ;
- permettre desactiver la dictée ;
- verifier consentement utilisateur si audio transmis a un fournisseur externe.

## 10. Ressources serveur

### Mode API uniquement

Besoins :
- CPU modeste ;
- RAM moderee ;
- stockage base + logs + pieces temporaires ;
- bande passante stable ;
- pas de GPU obligatoire.

### Mode LLM local petit

Besoins :
- CPU plus solide ;
- RAM plus importante ;
- eventuellement GPU ;
- stockage pour modeles Ollama.

### Mode LLM local lourd / DGX Spark

Besoins :
- GPU adapte ;
- RAM/VRAM importante ;
- supervision temperature/charge ;
- stockage modeles ;
- politique de redemarrage des services IA.

## 11. Base de donnees

Local :
- SQLite suffit pour essais mono-poste.

Serveur multi-utilisateur :
- envisager PostgreSQL ;
- migrations versionnees ;
- sauvegardes automatiques ;
- restauration testee ;
- chiffrement disque ;
- retention de donnees maitrisee.

### 11.1 Ce que la base heberge aujourd'hui

Dans le code actuel, la base ouverte par l'application est :

```text
backend/data/agent-mail-assistant.db
```

Le chemin est actuellement fixe dans `backend/src/services/databaseService.js`.
Il n'est pas encore pilote par une variable d'environnement.

La base ne sert pas seulement a stocker une preference technique. Elle contient deja des donnees fonctionnelles importantes :
- demandes de creation de compte ;
- comptes utilisateurs et administrateurs ;
- hash de mot de passe ;
- sessions utilisateur ;
- jetons de reinitialisation de mot de passe ;
- boites mail rattachees aux comptes ;
- connexions de boites mail ;
- etats OAuth Gmail, scopes, jetons d'acces et jetons de rafraichissement ;
- actions realisees ou preparees sur des messages Gmail ;
- sujets, expediteurs, identifiants Gmail, brouillons de reponse et corps de reponse ;
- ressources de boites mail partageables ;
- adhesions et permissions par utilisateur sur les boites mail ;
- etat de collaboration sur messages ;
- politiques d'automatisation ;
- sessions d'automatisation navigateur ;
- parametres applicatifs ;
- preferences utilisateur, dont reglages audio, mail et fournisseurs ;
- regles metier de traitement de mail ;
- comptes fournisseurs API et cles API chiffrees ou masquees ;
- evenements d'usage des fournisseurs API et estimation de cout ;
- statistiques utilisateur ;
- profils de facturation ;
- factures ;
- journal d'actions administratives ou compte.

Donc la base peut contenir des donnees sensibles :
- identite utilisateur ;
- e-mails ;
- informations de compte ;
- jetons OAuth ;
- brouillons de mail ;
- contenu de reponse ;
- configuration audio ;
- cles API chiffrees ;
- elements de facturation ;
- traces d'usage.

### 11.2 Ce que la base ne devrait pas heberger sans decision explicite

Pour limiter le risque serveur, il faut eviter d'y stocker par defaut :
- contenu complet de tous les mails Gmail synchronises ;
- pieces jointes completes ;
- audio brut de dictée ;
- transcriptions longues conservees sans raison ;
- logs complets des prompts LLM contenant les mails ;
- secrets en clair ;
- sauvegardes non chiffrees.

Orientation fonctionnelle retenue a ce stade :
- les mails ne doivent pas etre conserves durablement dans l'application ;
- leur gestion principale reste dans chaque boite mail individuelle ;
- l'application agit comme assistant de lecture, analyse, reponse, edition et automatisation ;
- la base conserve seulement les comptes, connexions, preferences, regles, droits, traces d'action et eventuels brouillons/actions necessaires ;
- les identifiants de messages Gmail peuvent etre conserves pour reference technique, mais pas une copie complete de la boite mail.

Si l'on decide un jour de stocker ces elements, il faudra ajouter :
- une finalite documentee ;
- une duree de conservation ;
- une fonction de suppression/export ;
- un chiffrement adapte ;
- une politique de sauvegarde et restauration ;
- une information utilisateur claire.

### 11.3 Consequence sur le choix SQLite ou PostgreSQL

SQLite reste coherent si :
- usage local ;
- mono-utilisateur ou tres petit nombre d'utilisateurs ;
- serveur de test ou demonstration ;
- un seul processus Node.js ;
- pas de haute disponibilite ;
- sauvegarde simple du fichier `.db` acceptee ;
- faible volume d'actions et d'evenements ;
- absence de stockage durable des mails complets ;
- pas de besoin d'administration base avancee.

PostgreSQL devient preferable si :
- plusieurs utilisateurs reels ;
- acces simultanes frequents ;
- partage de boites mail entre utilisateurs ;
- conservation d'historique d'actions importante ;
- facturation ou statistiques d'usage exploitables ;
- besoin de sauvegardes serveur robustes ;
- besoin de restauration partielle ;
- besoin d'audit ;
- besoin de roles et droits base ;
- plusieurs instances applicatives ;
- objectif de production publique ou associative ;
- besoin d'audit durable des actions ;
- stockage d'informations sensibles au-dela du strict local.

Decision provisoire :
- pour Windows local : SQLite ;
- pour serveur de test prive : SQLite possible si sauvegarde et acces serveur maitrises ;
- pour serveur associatif limite, sans conservation des mails complets : SQLite peut rester envisageable au debut, avec sauvegardes et prudence sur les acces simultanes ;
- pour serveur multi-utilisateur public, collaboratif ou avec audit durable : prevoir PostgreSQL avant ouverture reelle.

### 11.4 Impact technique d'un passage a PostgreSQL

Le passage a PostgreSQL ne sera pas un simple changement de variable `.env` dans l'etat actuel.

Il faudra prevoir :
- abstraction de la couche base aujourd'hui dependante de `node:sqlite` ;
- adaptation des requetes SQL si necessaire ;
- gestion des migrations versionnees ;
- creation du schema PostgreSQL ;
- migration des donnees existantes depuis SQLite ;
- tests de non-regression sur comptes, sessions, OAuth, preferences, regles, actions mail et fournisseurs ;
- procedure de sauvegarde/restauration PostgreSQL ;
- configuration securisee des acces base.

Conclusion :
- SQLite est suffisant pour continuer les essais locaux ;
- PostgreSQL doit etre traite comme un chantier serveur a part entiere, pas comme une option immediate.

## 12. Stockage fichiers

A prevoir :
- pieces jointes temporaires ;
- fichiers audio temporaires si utilises ;
- exports eventuels ;
- logs ;
- sauvegardes.

Regles :
- nettoyage automatique ;
- quotas ;
- taille maximale par fichier ;
- antivirus si ouverture aux uploads externes ;
- ne pas rendre les uploads directement publics.

## 13. Supervision et exploitation

Necessaire :
- demarrage automatique du serveur ;
- logs applicatifs ;
- logs erreurs ;
- monitoring uptime ;
- alerte si port indisponible ;
- suivi disque ;
- suivi RAM/CPU/GPU ;
- rotation des logs ;
- procedure de restauration.

Outils possibles :
- systemd sous Linux ;
- PM2 pour Node.js ;
- Docker Compose ;
- reverse proxy Nginx/Caddy ;
- sauvegardes planifiees.

## 14. Sauvegardes

Sauvegarder :
- base de donnees ;
- fichiers de configuration ;
- secrets via coffre dedie ;
- eventuels fichiers utilisateur ;
- version applicative.

Ne pas faire :
- stocker les sauvegardes uniquement sur le meme disque ;
- sauvegarder en clair des secrets dans un lieu non protege ;
- ne jamais tester la restauration.

## 15. Postes de cout

Les couts exacts dependent de l'hebergeur et devront etre chiffres au moment du choix.

Postes a prevoir :
- hebergement serveur ;
- stockage ;
- sauvegardes ;
- nom de domaine ;
- supervision ;
- envoi e-mail ;
- API LLM ;
- API STT dictée ;
- serveur GPU si IA locale lourde ;
- temps d'administration ;
- securite et maintenance ;
- eventuels couts de conformite.

Comparaison qualitative :
- API : cout variable a l'usage, faible infrastructure.
- Local CPU : cout infrastructure modere, performances limitees.
- Local GPU : cout infrastructure eleve, meilleure confidentialite et performances IA.

## 16. Risques principaux

- fuite de contenu mail ;
- fuite de cles API ;
- mauvaise separation entre utilisateurs ;
- logs trop bavards ;
- piece jointe mal geree ;
- OAuth mal configure ;
- serveur expose sans HTTPS ;
- absence de sauvegarde ;
- cout API non plafonne ;
- latence LLM ou STT incompatible avec l'usage.

## 17. Garde-fous recommandes avant production

Avant une vraie mise en ligne :
- revue securite des routes ;
- verification des secrets ;
- suppression des logs de debug sensibles ;
- HTTPS obligatoire ;
- sessions durcies ;
- limites de taille upload ;
- quotas API ;
- sauvegardes automatiques ;
- restauration testee ;
- documentation utilisateur ;
- plan d'incident.

## 18. Installation serveur : automatisation et actions manuelles

### 18.1 Situation actuelle

Il n'existe pas encore de script d'installation serveur complet dans le projet.

Les scripts disponibles aujourd'hui concernent l'installation locale Windows :
- `scripts/windows/install-local.ps1` ;
- `scripts/windows/start-local.ps1`.

Pour un serveur, un futur script pourrait automatiser une partie importante de l'installation technique, mais pas toutes les decisions ni toutes les configurations sensibles.

### 18.2 Ordre chronologique recommande

#### Etape 1 - Choisir le scenario d'hebergement

Nature :
- choisir entre serveur local, VPS, serveur GPU, DGX Spark ou cloud specialise.

Automatisable :
- non.

Intervention manuelle obligatoire :
- arbitrer confidentialite, cout, performance, acces distant et niveau de maintenance accepte.

Contraintes :
- un VPS classique suffit si les LLM/STT passent par API ;
- un LLM local confortable exige souvent un GPU ou une machine dediee ;
- un serveur public impose un vrai durcissement securite.

#### Etape 2 - Choisir le modele de donnees

Nature :
- decider si SQLite reste acceptable ou si PostgreSQL est necessaire.

Automatisable :
- partiellement, creation de base et utilisateur si le choix est deja fait.

Intervention manuelle obligatoire :
- decider selon le nombre d'utilisateurs, le besoin de sauvegarde et la criticite.

Contraintes :
- SQLite reste acceptable pour test, maquette ou mono-utilisateur ;
- PostgreSQL est preferable pour serveur multi-utilisateur ;
- une migration SQLite vers PostgreSQL doit etre planifiee et testee.

#### Etape 3 - Commander ou preparer le serveur

Nature :
- creer le serveur, installer le systeme, obtenir l'adresse IP.

Automatisable :
- partiellement chez certains hebergeurs via Terraform, Ansible ou scripts cloud.

Intervention manuelle obligatoire :
- choisir la region ;
- choisir la taille CPU/RAM/GPU ;
- choisir le disque ;
- accepter les couts ;
- definir le compte administrateur et les acces SSH.

Contraintes :
- privilegier une region compatible avec les exigences de protection des donnees ;
- prevoir assez de disque pour logs, base, sauvegardes et modeles IA ;
- prevoir GPU seulement si IA locale lourde.

#### Etape 4 - Nom de domaine et DNS

Nature :
- associer un nom de domaine au serveur.

Automatisable :
- non dans une premiere version simple ;
- partiellement via API DNS si le fournisseur le permet.

Intervention manuelle obligatoire :
- acheter ou choisir le nom de domaine ;
- creer l'enregistrement DNS vers l'IP du serveur.

Contraintes :
- le certificat HTTPS dependra du bon DNS ;
- les URLs OAuth Gmail devront correspondre au domaine final.

#### Etape 5 - Securiser l'acces systeme

Nature :
- configurer SSH, pare-feu, mises a jour et utilisateur applicatif.

Automatisable :
- oui, en grande partie par script Linux ou Ansible.

Intervention manuelle obligatoire :
- fournir ou choisir la cle SSH ;
- valider les ports ouverts ;
- decider qui a les droits administrateur.

Contraintes :
- desactiver l'acces inutile ;
- limiter les ports exposes, typiquement `80`, `443` et SSH restreint ;
- ne pas exposer directement Node.js ni la base de donnees.

#### Etape 6 - Installer les pre-requis applicatifs

Nature :
- installer Node.js, npm, Python, Git, eventuellement Docker, PM2, Nginx/Caddy.

Automatisable :
- oui.

Intervention manuelle obligatoire :
- choisir la strategie : installation systeme, Docker Compose ou PM2 ;
- valider les versions cibles.

Contraintes :
- Node.js 22 ou superieur ;
- Python disponible pour les fonctions PDF/transcription si utilisees ;
- Docker simplifie le deploiement mais ajoute une couche d'exploitation.

#### Etape 7 - Recuperer le code applicatif

Nature :
- deployer le code sur le serveur.

Automatisable :
- oui, via `git clone`, archive versionnee ou pipeline CI/CD.

Intervention manuelle obligatoire :
- definir la source de verite du code ;
- definir la branche ou la version a deployer ;
- configurer les droits d'acces au depot si prive.

Contraintes :
- ne jamais deployer un dossier contenant des secrets locaux non maitrises ;
- conserver une procedure de retour arriere.

#### Etape 8 - Installer les dependances de l'application

Nature :
- lancer `npm install` ou une installation de production ;
- installer les dependances Python necessaires.

Automatisable :
- oui.

Intervention manuelle obligatoire :
- choisir entre dependances de production seulement ou installation complete de test ;
- verifier la compatibilite systeme.

Contraintes :
- journaliser l'installation ;
- figer les versions si possible ;
- prevoir un relancement reproductible.

#### Etape 9 - Configurer les secrets et variables d'environnement

Nature :
- creer le `.env` serveur ou charger les variables depuis un coffre de secrets.

Automatisable :
- partiellement, generation d'un modele de fichier ;
- non pour la valeur reelle des secrets.

Intervention manuelle obligatoire :
- renseigner les secrets de session ;
- renseigner les secrets OAuth Gmail ;
- renseigner SMTP ;
- renseigner les cles API LLM/STT si utilisees ;
- choisir les URLs publiques.

Contraintes :
- ne jamais commiter le `.env` serveur ;
- ne pas mettre les secrets dans les logs ;
- renouveler les secrets si fuite suspectee ;
- utiliser des valeurs differentes de l'environnement local.

#### Etape 10 - Configurer OAuth Gmail et fournisseurs externes

Nature :
- declarer l'URL publique de redirection OAuth ;
- verifier les fournisseurs LLM/STT/API.

Automatisable :
- rarement, car depend des consoles fournisseurs.

Intervention manuelle obligatoire :
- configurer Google Cloud Console ;
- verifier l'URL de callback ;
- verifier les contrats ou conditions fournisseurs ;
- valider les quotas et plafonds.

Contraintes :
- l'URL doit etre en HTTPS ;
- l'URL doit correspondre exactement au domaine serveur ;
- les donnees envoyees aux API externes doivent etre encadrees.

#### Etape 11 - Configurer HTTPS et reverse proxy

Nature :
- installer Nginx ou Caddy ;
- obtenir un certificat Let's Encrypt ;
- rediriger HTTP vers HTTPS ;
- proxy vers Node.js.

Automatisable :
- oui en grande partie.

Intervention manuelle obligatoire :
- valider le domaine ;
- choisir le reverse proxy ;
- decider des limites de taille upload et timeouts.

Contraintes :
- HTTPS obligatoire en serveur public ;
- cookies `Secure` seulement valables en HTTPS ;
- Node.js ne doit pas etre expose directement si possible.

#### Etape 12 - Configurer le demarrage automatique

Nature :
- demarrer l'application comme service.

Automatisable :
- oui via systemd, PM2 ou Docker Compose.

Intervention manuelle obligatoire :
- choisir le gestionnaire de processus ;
- definir la politique de redemarrage ;
- valider les logs.

Contraintes :
- redemarrage automatique apres reboot ;
- redemarrage propre apres crash ;
- logs exploitables sans contenu sensible.

#### Etape 13 - Configurer IA locale ou API

Nature :
- installer Ollama ou autre runtime local ;
- telecharger les modeles ;
- ou configurer les cles API.

Automatisable :
- partiellement.

Intervention manuelle obligatoire :
- choisir les modeles ;
- accepter les ressources necessaires ;
- tester les temps de reponse ;
- decider si les donnees peuvent partir vers API externe.

Contraintes :
- Mistral local semble suffisant pour certains essais ;
- Gemma 4 26B a ete trop lent sur Mac et devra etre reteste sur DGX Spark ou GPU ;
- les modeles locaux exigent stockage et memoire ;
- les API exigent budget, quotas et clauses de protection de donnees.

#### Etape 14 - Configurer dictée et audio

Nature :
- choisir Deepgram, AssemblyAI, whisper.cpp ou autre STT local.

Automatisable :
- partiellement.

Intervention manuelle obligatoire :
- choisir le fournisseur ;
- renseigner les cles ;
- verifier consentement et politique audio ;
- tester micro et latence en condition reelle.

Contraintes :
- l'audio est une donnee sensible ;
- les sessions live doivent etre limitees et nettoyees ;
- un STT local reduit les transferts mais augmente les besoins machine.

#### Etape 15 - Sauvegardes et restauration

Nature :
- sauvegarder base, configurations, fichiers utiles et version applicative.

Automatisable :
- oui, en grande partie.

Intervention manuelle obligatoire :
- choisir la destination de sauvegarde ;
- choisir la retention ;
- proteger les sauvegardes ;
- tester une restauration.

Contraintes :
- une sauvegarde non testee ne suffit pas ;
- ne pas stocker uniquement sur le meme disque ;
- chiffrer les sauvegardes contenant des donnees personnelles ou secrets.

#### Etape 16 - Supervision et alertes

Nature :
- surveiller uptime, disque, CPU, RAM, GPU, logs et erreurs.

Automatisable :
- oui.

Intervention manuelle obligatoire :
- choisir le niveau d'alerte ;
- choisir les destinataires ;
- definir ce qui est critique.

Contraintes :
- eviter de journaliser des contenus de mails ;
- surveiller les couts API ;
- surveiller le remplissage disque.

#### Etape 17 - Tests de recette avant ouverture

Nature :
- verifier que le serveur fonctionne avant usage reel.

Automatisable :
- partiellement, tests techniques.

Intervention manuelle obligatoire :
- tester les parcours utilisateur ;
- tester Gmail OAuth ;
- tester envoi mail ;
- tester pieces jointes ;
- tester dictée ;
- tester LLM choisi ;
- tester sauvegarde/restauration ;
- tester perte de session et reprise.

Contraintes :
- ne pas ouvrir au public avant cette etape ;
- corriger les logs sensibles ;
- verifier que les secrets de test ne sont pas ceux de production.

#### Etape 18 - Decision d'ouverture

Nature :
- autoriser l'usage par d'autres utilisateurs.

Automatisable :
- non.

Intervention manuelle obligatoire :
- valider securite ;
- valider documentation ;
- valider RGPD/protection des donnees ;
- valider support et procedure incident.

Contraintes :
- definir qui administre ;
- definir qui peut acceder ;
- definir quoi faire en cas d'incident.

### 18.3 Ce qu'un futur script serveur pourrait automatiser

Un futur script pourrait faire :
- installer Node.js, Python, Git et dependances systeme ;
- recuperer le code ;
- lancer `npm install` ;
- creer l'utilisateur applicatif ;
- creer les dossiers de donnees ;
- generer un fichier `.env.example.server` ;
- configurer systemd ou PM2 ;
- installer et configurer Nginx/Caddy ;
- demander un certificat Let's Encrypt ;
- configurer des sauvegardes planifiees ;
- installer Ollama si le mode local est choisi ;
- telecharger un modele local leger ;
- lancer des tests de sante.

### 18.4 Ce qui restera manuel meme avec un bon script

Restera manuel ou decisionnel :
- choix de l'hebergeur ;
- choix CPU/RAM/GPU ;
- choix SQLite/PostgreSQL ;
- achat ou configuration du nom de domaine ;
- creation des secrets ;
- configuration Google OAuth ;
- choix et contrats fournisseurs API ;
- validation RGPD ;
- choix des durees de conservation ;
- validation du niveau de logs ;
- validation des couts ;
- test fonctionnel final ;
- decision d'ouverture aux utilisateurs.

## 19. Decision provisoire

Pour demain :
- viser une version Windows locale, pas un serveur public ;
- garder Mistral local comme LLM local principal ;
- garder Gemma 4 comme piste a retester plus tard sur DGX Spark ;
- documenter l'installation et valider sur un vrai poste Windows.

Pour le serveur :
- ne pas exposer l'application telle quelle sans durcissement ;
- preparer une architecture HTTPS + base serveur + secrets + sauvegardes ;
- chiffrer et limiter les donnees sensibles ;
- chiffrer ou encadrer tout appel a API externe.
