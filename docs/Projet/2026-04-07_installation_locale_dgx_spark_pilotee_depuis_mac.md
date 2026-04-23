# Installation locale sur DGX Spark pilotee depuis Mac

Date : 2026-04-07

## 1. Objectif

Prevoir une installation locale de l'application Accessible Mail Assistant sur un NVIDIA DGX Spark, avec pilotage depuis un Mac ou un autre poste client.

Dans ce scenario :
- le DGX Spark heberge l'application ;
- le Mac sert de poste de pilotage et d'acces navigateur ;
- les traitements IA locaux peuvent tourner sur le DGX Spark ;
- les mails restent geres dans les boites mail individuelles ;
- l'application ne doit pas devenir une archive complete de mails.

## 2. Positionnement

Le DGX Spark doit etre considere comme un serveur local prive, pas comme un serveur public Internet par defaut.

Usage vise :
- developpement ;
- tests IA locaux ;
- evaluation de modeles plus lourds que sur Mac ;
- demonstration locale ;
- eventuellement petit usage prive sur reseau local.

Usage a eviter au debut :
- exposition directe sur Internet ;
- ouverture multi-utilisateur sans durcissement ;
- stockage massif des mails ;
- stockage audio durable ;
- absence de sauvegarde.

## 3. Architecture cible simple

Architecture recommandee pour commencer :

```text
Mac / navigateur
  |
  | reseau local
  v
DGX Spark
  - backend Node.js
  - frontend servi localement
  - SQLite au debut ou PostgreSQL si version serveur ciblee
  - Ollama / runtime IA local
  - eventuel STT local
  - acces API externes si necessaire
```

Le Mac n'execute pas l'application. Il ouvre seulement l'interface dans le navigateur :

```text
http://ADRESSE_DGX:3000/frontend/account.html
http://ADRESSE_DGX:3000/frontend/mail.html
```

## 4. Decisions a prendre avant installation

### 4.1 Base de donnees

Pour une installation locale DGX Spark de test :
- SQLite peut suffire.

Pour une installation DGX Spark appelee a devenir serveur multi-utilisateur :
- PostgreSQL est preferable des le depart.

Decision provisoire recommandee :
- commencer avec SQLite si l'objectif est test local ;
- prevoir PostgreSQL si l'objectif est d'ouvrir l'application a plusieurs utilisateurs.

### 4.2 IA locale

Le DGX Spark est une meilleure cible que le Mac pour tester :
- Gemma 4 ;
- Qwen ;
- Mistral plus lourd ;
- modeles residents pour edition vocale.

Decision provisoire recommandee :
- garder Mistral comme modele de reference fiable ;
- retester Gemma 4 sur DGX Spark ;
- tester ensuite un modele plus adapte aux commandes vocales courtes si necessaire.

### 4.3 Dictée

Options :
- conserver AssemblyAI ou Deepgram pour le live ;
- tester une solution STT locale sur DGX Spark ;
- garder l'audio le moins longtemps possible.

Decision provisoire recommandee :
- garder le fonctionnement actuel pour ne pas changer trop de variables ;
- tester ensuite un STT local comme chantier separe.

## 5. Installation manuelle chronologique

### Etape 1 - Connecter le DGX Spark au reseau local

Objectif :
- obtenir une adresse IP stable ou un nom local.

Actions :
- connecter le DGX Spark au reseau ;
- verifier son adresse IP ;
- verifier que le Mac peut le joindre.

Exemple depuis le Mac :

```bash
ping ADRESSE_DGX
```

Contrainte :
- pour un usage confortable, eviter que l'adresse IP change a chaque redemarrage.

### Etape 2 - Activer l'acces distant

Objectif :
- pouvoir administrer le DGX Spark depuis le Mac.

Actions :
- activer SSH sur le DGX Spark si ce n'est pas deja fait ;
- se connecter depuis le Mac.

Exemple :

```bash
ssh utilisateur@ADRESSE_DGX
```

Contrainte :
- privilegier une cle SSH plutot qu'un mot de passe si l'installation devient durable.

### Etape 3 - Verifier le systeme et les outils de base

Objectif :
- confirmer l'environnement logiciel.

Commandes a verifier sur le DGX Spark :

```bash
uname -a
node -v
npm -v
python3 --version
git --version
```

Si Node.js n'est pas present ou trop ancien :
- installer Node.js 22 ou superieur.

Contrainte :
- le projet utilise aujourd'hui `node:sqlite`, disponible avec les versions recentes de Node.js.

### Etape 4 - Recuperer le projet

Option A : depuis Git :

```bash
git clone URL_DU_DEPOT ACCESSIBLE_MAIL_ASSISTANT_MULTI
cd ACCESSIBLE_MAIL_ASSISTANT_MULTI
```

Option B : copie depuis le Mac :

```bash
scp -r /chemin/local/ACCESSIBLE_MAIL_ASSISTANT_MULTI utilisateur@ADRESSE_DGX:~/
```

Contrainte :
- ne pas copier de secrets Mac non maitrises ;
- verifier le fichier `.env` avant usage.

### Etape 5 - Installer les dependances

Depuis le dossier projet sur le DGX Spark :

```bash
npm install
python3 -m pip install --user pypdf faster-whisper
```

Contrainte :
- adapter Python si la commande systeme est `python` au lieu de `python3`.

### Etape 6 - Configurer `.env`

Creer ou adapter :

```text
.env
```

Valeurs a verifier :

```env
PORT=3000
APP_BASE_URL=http://ADRESSE_DGX:3000
GOOGLE_OAUTH_REDIRECT_URI=http://ADRESSE_DGX:3000/api/mailbox/google/callback
OLLAMA_BASE_URL=http://localhost:11434/v1
```

Secrets a renseigner selon les fonctions utilisees :
- secrets de session ;
- Gmail OAuth ;
- SMTP ;
- API Deepgram ou AssemblyAI ;
- API Mistral ou DeepSeek si utilisees ;
- eventuelles cles fournisseur.

Contrainte :
- si Gmail OAuth est utilise depuis le DGX Spark, l'URL de redirection doit correspondre a l'adresse reelle utilisee depuis le navigateur.

### Etape 7 - Installer ou verifier Ollama / runtime IA local

Objectif :
- permettre l'execution des LLM locaux sur le DGX Spark.

Commandes de verification :

```bash
ollama --version
ollama list
```

Modeles de test :

```bash
ollama pull mistral:latest
ollama pull gemma4:26b
```

Test :

```bash
ollama run mistral:latest
```

Contrainte :
- le nom exact du modele doit correspondre a `ollama list` ;
- si l'application doit utiliser Gemma 4, definir par exemple :

```bash
export OLLAMA_GEMMA4_MODEL="gemma4:26b"
```

### Etape 8 - Lancer l'application sur le DGX Spark

Depuis le dossier projet :

```bash
npm start
```

Puis depuis le Mac :

```text
http://ADRESSE_DGX:3000/frontend/account.html
```

Contrainte :
- le pare-feu du DGX Spark doit autoriser l'acces au port choisi depuis le Mac ;
- ne pas exposer ce port directement sur Internet.

### Etape 9 - Tests de recette

Tester dans cet ordre :
- ouverture de la page compte ;
- connexion ;
- ouverture de la page mail ;
- choix du LLM local Mistral ;
- generation simple ;
- dictée courte ;
- edition vocale `Commande IA locale` ;
- test Gemma 4 si souhaite ;
- test Gmail OAuth si configure ;
- test envoi SMTP si configure.

### Etape 10 - Stabilisation en service local

Si l'installation doit rester active :
- ajouter un service `systemd` ou PM2 ;
- definir un redemarrage automatique ;
- definir un dossier de logs ;
- definir une sauvegarde de la base ;
- documenter les commandes de demarrage/arret.

## 6. Ce qu'un script DGX pourrait automatiser

Un futur script `scripts/linux/install-dgx-local.sh` pourrait automatiser :
- verification Node.js, npm, Python, Git ;
- installation des dependances npm ;
- installation des packages Python ;
- creation des dossiers de donnees ;
- creation d'un `.env` depuis un modele `.env.dgx.example` ;
- controle d'Ollama ;
- telechargement optionnel de `mistral:latest` ;
- telechargement optionnel de `gemma4:26b` ;
- test de sante backend ;
- creation optionnelle d'un service systemd.

## 7. Ce qui restera manuel

Restera manuel :
- branchement reseau ;
- choix IP ou nom local ;
- activation SSH ;
- choix SQLite ou PostgreSQL ;
- renseignement des secrets ;
- configuration Google OAuth ;
- configuration SMTP ;
- choix des modeles LLM ;
- choix d'utiliser ou non un STT local ;
- autorisation d'acces reseau depuis le Mac ;
- validation fonctionnelle.

## 8. Points de vigilance

Securite :
- ne pas exposer l'application sur Internet sans HTTPS et durcissement ;
- ne pas laisser de secrets en clair dans un depot ;
- proteger les jetons OAuth Gmail ;
- limiter les logs contenant des contenus de mail.

Donnees :
- ne pas conserver les mails complets par defaut ;
- ne pas conserver l'audio brut par defaut ;
- sauvegarder la base si l'installation devient durable.

Performance :
- Mistral doit servir de modele local de reference ;
- Gemma 4 doit etre reteste sur DGX Spark ;
- mesurer le temps de reponse reel avant d'en faire un modele par defaut ;
- separer les tests LLM des tests dictée pour diagnostiquer proprement.

RGPD :
- usage strictement personnel local : charge RGPD reduite ;
- usage multi-utilisateur, associatif ou professionnel : demarche RGPD a prevoir ;
- document dedie : `docs/Projet/2026-04-07_integration_rgpd_installation_locale_et_serveur.md`.

## 9. Decision provisoire

Pour une premiere installation locale DGX Spark :
- installer l'application sur le DGX Spark ;
- piloter depuis le Mac via navigateur ;
- commencer avec SQLite si usage prive/test ;
- garder Mistral local comme reference ;
- retester Gemma 4 sur DGX Spark ;
- ne pas exposer publiquement ;
- documenter ensuite les resultats pour decider PostgreSQL, HTTPS et service permanent.
