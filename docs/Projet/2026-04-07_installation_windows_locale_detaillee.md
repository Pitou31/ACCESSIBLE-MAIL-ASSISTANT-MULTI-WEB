# Installation Windows locale detaillee

Date : 2026-04-07

## 1. Objectif

Installer et lancer l'application Accessible Mail Assistant sur un poste Windows local.

Cette procedure vise un usage local de test ou de demonstration :
- backend Node.js sur le poste Windows ;
- frontend servi par le backend local ;
- base SQLite locale ;
- IA locale via Ollama ou API distante ;
- dictée via fournisseur API live ou transcription locale selon configuration ;
- connexion Gmail OAuth si les secrets Google sont renseignes.

## 2. Principe general

Le poste Windows doit contenir :
- le code du projet ;
- Node.js et npm ;
- Python ;
- optionnellement Ollama pour les LLM locaux ;
- optionnellement les outils de transcription locale si l'on veut eviter les API de dictée.

Le script existant automatise la partie applicative :

```powershell
.\scripts\windows\install-local.ps1
```

Un script de demarrage local est aussi disponible :

```powershell
.\scripts\windows\start-local.ps1
```

## 3. Pre-requis a installer manuellement

### 3.1 Node.js

Installer Node.js 22 LTS ou superieur.

Verification :

```powershell
node -v
npm -v
```

### 3.2 Python

Installer Python 3 et cocher l'option `Add Python to PATH`.

Verification :

```powershell
python --version
python -m pip --version
```

### 3.3 Ollama, optionnel

Installer Ollama seulement si l'on veut utiliser les modeles locaux.

Verification :

```powershell
ollama --version
ollama list
```

Modeles locaux conseilles pour commencer :

```powershell
ollama pull mistral:latest
ollama pull deepseek-r1:latest
```

Gemma 4 peut rester installe pour essais ulterieurs, mais sur Mac il a ete trop lent dans l'application avec `gemma4:26b`.

## 4. Preparation du dossier projet

Copier le projet dans un chemin simple, par exemple :

```text
C:\ACCESSIBLE_MAIL_ASSISTANT_MULTI
```

Eviter :
- les chemins trop longs ;
- les dossiers synchronises agressivement par OneDrive ;
- les caracteres speciaux dans le chemin de base ;
- les dossiers necessitant des droits administrateur.

## 5. Installation automatisee

Ouvrir PowerShell dans le dossier du projet :

```powershell
cd C:\ACCESSIBLE_MAIL_ASSISTANT_MULTI
```

Si PowerShell bloque l'execution des scripts :

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Lancer l'installation standard :

```powershell
.\scripts\windows\install-local.ps1
```

Avec controle Ollama :

```powershell
.\scripts\windows\install-local.ps1 -WithOllama
```

Pour recreer le `.env` depuis le modele :

```powershell
.\scripts\windows\install-local.ps1 -ForceEnv
```

## 5.1 Niveau reel d'automatisation

Le script Windows n'est pas une installation totalement autonome du poste.

Il automatise l'installation applicative, une fois que les pre-requis systeme sont deja presents :
- dependances Node.js ;
- dependances Python applicatives ;
- creation du dossier de donnees local ;
- creation du fichier `.env` depuis le modele ;
- controle optionnel d'Ollama.

Il ne fait pas automatiquement :
- installation de Node.js ;
- installation de Python ;
- installation d'Ollama ;
- telechargement des modeles Ollama ;
- creation des identifiants Google OAuth ;
- creation des mots de passe SMTP ou cles API ;
- configuration du micro Windows ;
- autorisation navigateur pour le micro ;
- ouverture automatique du navigateur ;
- creation d'un raccourci Windows ;
- installation comme service Windows.

Ce choix est volontaire : ces operations modifient le systeme Windows, dependent du compte utilisateur, des droits administrateur et des secrets reels.

## 5.2 Interventions manuelles restantes

### Copier ou recuperer le projet

Nature :
- copier le dossier projet sur le poste Windows ;
- ou le recuperer depuis Git si le poste est equipe pour cela.

Contrainte :
- choisir un chemin simple, par exemple `C:\ACCESSIBLE_MAIL_ASSISTANT_MULTI` ;
- eviter OneDrive, les chemins tres longs et les dossiers necessitant des droits administrateur.

### Installer Node.js

Nature :
- installer Node.js 22 LTS ou superieur.

Contrainte :
- le script refuse les versions inferieures a 22 ;
- `node` et `npm` doivent etre disponibles dans le `PATH`.

Verification :

```powershell
node -v
npm -v
```

### Installer Python

Nature :
- installer Python 3.

Contrainte :
- cocher `Add Python to PATH` pendant l'installation ;
- `python` et `pip` doivent etre disponibles.

Verification :

```powershell
python --version
python -m pip --version
```

### Autoriser les scripts PowerShell

Nature :
- permettre l'execution des scripts locaux.

Contrainte :
- peut dependre de la politique de securite Windows ou de l'organisation.

Commande utilisateur courant :

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Installer Ollama, si LLM local souhaite

Nature :
- installer Ollama pour utiliser `mistral:latest`, `deepseek-r1:latest`, etc.

Contrainte :
- Ollama doit etre lance ;
- les modeles doivent etre telecharges ;
- les modeles lourds peuvent etre tres lents selon le PC.

Commandes typiques :

```powershell
ollama pull mistral:latest
ollama pull deepseek-r1:latest
```

### Renseigner le fichier `.env`

Nature :
- ouvrir `.env` et renseigner les secrets necessaires.

Contrainte :
- les secrets ne peuvent pas etre devines par le script ;
- sans ces valeurs, les fonctions associees restent indisponibles.

Exemples :
- Gmail OAuth pour la connexion Gmail ;
- SMTP pour l'envoi ;
- cles API Deepgram, AssemblyAI, Mistral ou DeepSeek si utilisees ;
- secrets de session applicatifs.

### Configurer Gmail OAuth, si Gmail utilise

Nature :
- creer ou reutiliser une application OAuth Google ;
- renseigner l'URL de redirection locale.

Contrainte :
- l'URL doit correspondre au port utilise par l'application.

Exemple :

```text
http://localhost:3000/api/mailbox/google/callback
```

### Autoriser le micro

Nature :
- autoriser le navigateur a utiliser le micro.

Contrainte :
- l'autorisation se fait cote navigateur ;
- Windows peut aussi avoir une restriction de confidentialite sur le micro.

### Premier test fonctionnel

Nature :
- lancer l'application ;
- ouvrir la page ;
- verifier compte, mail, LLM, dictée.

Contrainte :
- certains tests dependent des secrets renseignes et des services externes disponibles.

## 6. Ce que fait le script

Le script :
- verifie `node`, `npm`, `python` ;
- refuse Node.js si la version est inferieure a 22 ;
- lance `npm install` ;
- installe les dependances Python utiles ;
- cree le dossier `backend\data` ;
- genere `.env` depuis `.env.windows.example` si necessaire ;
- controle Ollama si l'option `-WithOllama` est utilisee.

Le script n'installe pas automatiquement Node.js, Python ni Ollama. C'est volontaire pour eviter les installations systeme non maitrisees.

## 7. Fichier `.env` a verifier

Apres installation, ouvrir :

```text
C:\ACCESSIBLE_MAIL_ASSISTANT_MULTI\.env
```

Verifier notamment :

```env
PORT=3000
APP_BASE_URL=http://localhost:3000
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/mailbox/google/callback
OLLAMA_BASE_URL=http://localhost:11434/v1
```

Secrets a renseigner selon les usages :
- `SESSION_SECRET`
- `MAILBOX_TOKEN_SECRET`
- `APP_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `DEEPSEEK_API_KEY`
- `MISTRAL_API_KEY`
- `DEEPGRAM_API_KEY`
- `ASSEMBLYAI_API_KEY`

Pour un test purement local sans Gmail, SMTP ni API distante, certaines cles peuvent rester non renseignees, mais les fonctions correspondantes seront indisponibles.

## 8. Demarrage local

Demarrage simple :

```powershell
.\scripts\windows\start-local.ps1
```

Ou directement :

```powershell
npm start
```

Si le port 3000 est deja occupe :

```powershell
.\scripts\windows\start-local.ps1 -Port 3001
```

Si l'on veut forcer Gemma 4 pour essai :

```powershell
.\scripts\windows\start-local.ps1 -OllamaGemma4Model "gemma4:26b"
```

## 9. Ouverture de l'application

Dans le navigateur :

```text
http://localhost:3000/frontend/account.html
```

Puis apres connexion :

```text
http://localhost:3000/frontend/mail.html
```

Si le port a ete change, adapter l'URL.

## 10. Verification apres installation

Verifier dans cet ordre :

1. le serveur affiche `Serveur demarre sur http://localhost:3000` ;
2. `account.html` s'ouvre ;
3. la connexion utilisateur fonctionne ;
4. `mail.html` s'ouvre ;
5. le choix `Mistral local` apparait ;
6. `ollama list` affiche `mistral:latest` si l'on veut utiliser le local ;
7. la generation avec `Mistral local` fonctionne ;
8. la dictée est active si les parametres et le fournisseur sont configures ;
9. les pieces jointes simples fonctionnent ;
10. la base SQLite est creee dans `backend\data`.

## 11. Donnees locales importantes

Base SQLite :

```text
backend\data\agent-mail-assistant.db
```

Fichiers sensibles :
- `.env`
- base SQLite ;
- eventuels fichiers de logs ;
- eventuels caches ou pieces jointes temporaires.

Ces fichiers ne doivent pas etre envoyes dans un depot public.

## 12. Sauvegarde locale

Avant gros essai ou modification :
- sauvegarder le dossier projet ;
- ou au minimum sauvegarder `backend\data` et `.env`.

Les sauvegardes applicatives du projet sont rangees dans :

```text
sauvegarde\
```

## 13. Points de vigilance Windows

- Si `npm start` indique `EADDRINUSE`, un serveur tourne deja sur le port.
- Si la page ancienne continue a apparaitre, forcer le rafraichissement navigateur.
- Si Ollama ne repond pas, lancer Ollama puis refaire `ollama list`.
- Si la dictée ne fonctionne pas, verifier les permissions micro du navigateur.
- Si Gmail OAuth echoue, verifier l'URL de redirection dans Google Cloud.
- Si l'application ne trouve pas le modele local, verifier le nom exact avec `ollama list`.

## 14. Validation minimale pour demain

Campagne minimale :
- demarrage serveur ;
- ouverture `account.html` ;
- ouverture `mail.html` ;
- generation simple avec `Mistral local` ;
- test `Commande IA locale` sur un cas simple ;
- test dictée si le fournisseur audio est configure ;
- controle que les donnees restent locales.
